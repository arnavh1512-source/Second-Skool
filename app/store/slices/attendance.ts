import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import { studentKey } from '../../lib/student-key'
import { loadQueue, saveQueue, resolveBatch, type QueuedBatch, type QueuedMark } from '../../lib/att-queue'
import { dbErr } from '../db'
import { looksOffline } from '../errors'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { Actions } from '../types'

/** Two drains at once would each read the same register, each find it unwritten
 *  and each write it. Module-level because the guard has to outlive any one
 *  call, and there is exactly one queue on the device. */
let draining = false

/** The parents of the children marked absent. Deliberately separate from the
 *  save itself: the attendance is already committed by the time this runs, so a
 *  failed notification must never read as a failed save. */
async function tellParents(absent: readonly QueuedMark[], notify: Actions['notify']) {
  if (!absent.length) return
  const rows = absent.map(m => ({
    student_id: m.studentId,
    title: 'Marked absent today',
    detail: `${m.name} was marked absent. Please contact the centre if this is a mistake.`,
    icon: 'absence',
  }))
  await supabase.from('notifications').insert(rows).then(dbErr('send the absence notifications', notify))
  const codes = absent.map(m => m.code).filter(Boolean)
  if (codes.length) {
    await sendPush({
      studentCodes: codes,
      title: 'Marked absent today',
      body: 'Your ward was marked absent at the centre today.',
    }).catch(() => {})
  }
}

export const createAttendanceSlice: Slice<'toggleAtt' | 'saveAttendance' | 'syncAttQueue' | 'dismissAttConflicts'> = (set, get) => {
  // localStorage is the queue's source of truth and `attQueue` is the mirror the
  // screens render. Writing the disk first means a phone that dies between the
  // save and the next paint still has the register on it — which is the entire
  // reason this exists.
  const commit = (queue: QueuedBatch[]) => {
    saveQueue(queue)
    set({ attQueue: queue })
  }

  const enqueue = (date: string, marks: QueuedMark[]) => {
    const batch: QueuedBatch = { id: `${date}-${Date.now()}`, date, marks }
    commit([...loadQueue(), batch])
    get().notify(`Saved on this phone · ${marks.length} marks. They will sync by themselves once you are back online.`)
  }

  return {
    // Keyed by the student, not by their slot in the roster. The roster reorders
    // on every background refresh, and an index-keyed mark then moves to whoever
    // now holds that slot — marking the wrong child absent and pushing that to
    // their parent, which is the one message a centre cannot take back.
    toggleAtt: (key) => set((s) => ({ att: { ...s.att, [key]: s.att[key] === 'absent' ? 'present' : 'absent' } })),

    // Takes the roster as student objects, not names. Names are not unique — two
    // students called "Rahul Sharma" both resolved to the first match, so the
    // upsert (keyed on student_id + date) wrote one row twice and the second
    // Rahul silently inherited the first one's status. Every centre has repeated
    // names, so this was a matter of when, not if.
    //
    // Awaits the write before saying anything. The previous version fired the
    // upsert and toasted "Attendance saved · 28 present" in the same tick, so a
    // save rejected by RLS, dropped by a flaky connection or refused by a
    // constraint still showed green — on the screen a teacher touches every
    // working day, holding the one record parents actually watch.
    saveAttendance: async (roster) => {
      const { att, online } = get()
      const notify = get().notify

      const marks: QueuedMark[] = roster
        .filter((s) => !!s?.dbId)
        .map((s) => ({
          studentId: s.dbId as string,
          code: s.id ?? '',
          name: s.name,
          status: att[studentKey(s)] === 'absent' ? 'Absent' as const : 'Present' as const,
        }))

      if (!marks.length) {
        notify('No students in this class yet — add students before marking attendance', 'error')
        return
      }

      // The date is fixed here, at the moment she marks. A batch queued tonight
      // and drained tomorrow is still tonight's register.
      const date = isoDay()
      const present = marks.filter(m => m.status === 'Present').length

      // Checked up front so she is told before she walks away, rather than after
      // a round-trip that may never come back on a stalled mobile connection.
      if (!online) { enqueue(date, marks); return }

      const ids = marks.map(m => m.studentId)
      // Warn when overwriting: another teacher may have marked this class already.
      const { data: existing } = await supabase.from('attendance').select('id').eq('date', date).in('student_id', ids).limit(1)
      const already = !!existing?.length

      const rows = marks.map(m => ({ student_id: m.studentId, date, status: m.status }))
      const res = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' })
      if (res.error) {
        // navigator.onLine reports that a network interface exists, which on
        // Indian mobile data is regularly true while nothing gets through. The
        // failed write is the first honest evidence of that, so this is where
        // the flag gets corrected and the register gets kept instead of lost.
        if (looksOffline(res.error)) { get().setOnline(false); enqueue(date, marks); return }
        dbErr('save attendance', notify)(res)
        return
      }

      notify(already
        ? `Attendance updated · ${present} present (today was already marked)`
        : `Attendance saved · ${present} present`)

      // Tell only the absent students (their parents watch these devices).
      await tellParents(marks.filter(m => m.status === 'Absent'), notify)

      // Re-pull so the Students list shows the new attendance % right away,
      // instead of staying stale until the next focus/manual refresh.
      await get().refreshData()
    },

    // Called on reconnect, on focus and once on mount. Reading the queue off the
    // disk rather than off `attQueue` is what makes the mount call double as the
    // hydration: before this runs the store has never seen what is on the phone.
    syncAttQueue: async () => {
      const queue = loadQueue()
      if (!queue.length) { if (get().attQueue.length) set({ attQueue: [] }); return }
      set({ attQueue: queue })
      if (!get().online || !get().role || draining) return

      draining = true
      const notify = get().notify
      const kept: QueuedBatch[] = []
      const conflicts = [...get().attConflicts]
      let written = 0

      try {
        for (const batch of queue) {
          const ids = batch.marks.map(m => m.studentId)
          const { data: existing, error: readErr } = await supabase
            .from('attendance').select('student_id,status').eq('date', batch.date).in('student_id', ids)
          // Could not even look: the connection is still not real. Keep the
          // batch and try again on the next reconnect — dropping it here would
          // lose the register for a reason she never sees.
          if (readErr) { kept.push(batch); continue }

          const { rows, absent, conflicts: found } = resolveBatch(batch, existing ?? [])
          conflicts.push(...found)

          if (rows.length) {
            const res = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,date' })
            if (res.error) {
              if (looksOffline(res.error)) { kept.push(batch); get().setOnline(false); break }
              // A rejection that retrying cannot fix — RLS, a deleted student, a
              // constraint. Keeping it would retry it forever on every
              // reconnect, so it is dropped, and said out loud rather than
              // disappearing.
              notify(`${batch.marks.length} queued marks from ${batch.date} could not be saved. Please mark that class again.`, 'error')
              continue
            }
            written += rows.length
            await tellParents(absent, notify)
          }
        }
      } finally {
        draining = false
      }

      commit(kept)
      set({ attConflicts: conflicts })

      // The conflicts are not toasted. A toast is gone in four seconds and this
      // is a list she has to act on — it lives on the attendance screen until
      // she dismisses it.
      if (written) {
        notify(`${written} attendance marks saved from when you were offline.`)
        await get().refreshData()
      }
    },

    dismissAttConflicts: () => set({ attConflicts: [] }),
  }
}
