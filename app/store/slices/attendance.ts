import { supabase } from '../../lib/supabase'
import { sendPush } from '../../lib/push'
import { dbErr } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'

export const createAttendanceSlice: Slice<'toggleAtt' | 'saveAttendance'> = (set, get) => ({
  toggleAtt: (i) => set((s) => ({ att: { ...s.att, [i]: s.att[i] === 'absent' ? 'present' : 'absent' } })),

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
  // working day, holding the one record parents actually watch. Nine other
  // actions got this fix in f601d39; saveAttendance was edited in that same
  // commit for the duplicate-name bug, and this line was left behind.
  saveAttendance: async (roster) => {
    const { att, online } = get()
    const notify = get().notify

    const records = roster.map((student, i) => {
      if (!student?.dbId) return null
      return { student_id: student.dbId, date: isoDay(), status: att[i] === 'absent' ? 'Absent' : 'Present' }
    }).filter((r): r is NonNullable<typeof r> => r !== null)

    if (!records.length) {
      notify('No students in this class yet — add students before marking attendance', 'error')
      return
    }
    // Checked up front so she is told before she walks away, rather than after
    // a round-trip that may never come back on a stalled mobile connection.
    if (!online) {
      notify('No internet — attendance has NOT been saved. Stay on this screen and tap Save again once you are back online.', 'error')
      return
    }

    // Warn when overwriting: another teacher may have marked this class already.
    const today = isoDay()
    const ids = records.map(r => r.student_id)
    const { data: existing } = await supabase.from('attendance').select('id').eq('date', today).in('student_id', ids).limit(1)
    const already = !!existing?.length

    const res = await supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' })
    if (res.error) { dbErr('save attendance', notify)(res); return }

    // Count absences within *this* roster. Reading every value in `att` also
    // counted leftover marks from a bigger class marked earlier in the session.
    const present = roster.length - roster.filter((_, i) => att[i] === 'absent').length
    notify(already
      ? `Attendance updated · ${present} present (today was already marked)`
      : `Attendance saved · ${present} present`)

    // Tell only the absent students (their parents watch these devices).
    // Deliberately after the toast: the attendance itself is already committed,
    // so a failed notification must not read as a failed save.
    const absent = roster.filter((s, i) => att[i] === 'absent' && !!s?.dbId)
    if (absent.length) {
      const rows = absent.map(s => ({ student_id: s.dbId, title: 'Marked absent today', detail: `${s.name} was marked absent. Please contact the centre if this is a mistake.`, icon: 'absence' }))
      await supabase.from('notifications').insert(rows).then(dbErr('send the absence notifications', notify))
      const codes = absent.map(s => s.id).filter(Boolean)
      if (codes.length) await sendPush({ studentCodes: codes, title: 'Marked absent today', body: 'Your ward was marked absent at the centre today.' }).catch(() => {})
    }

    // Re-pull so the Students list shows the new attendance % right away,
    // instead of staying stale until the next focus/manual refresh.
    await get().refreshData()
  },
})
