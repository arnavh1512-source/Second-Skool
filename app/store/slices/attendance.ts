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
  saveAttendance: (roster) => {
    const { att } = get()
    const records = roster.map((student, i) => {
      if (!student?.dbId) return null
      return { student_id: student.dbId, date: isoDay(), status: att[i] === 'absent' ? 'Absent' : 'Present' }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
    if (records.length) {
      // Warn when overwriting: another teacher may have marked this class already.
      const today = isoDay()
      const ids = records.map(r => r.student_id)
      supabase.from('attendance').select('id').eq('date', today).in('student_id', ids).limit(1).then(({ data }) => {
        const already = !!data?.length
        supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' }).then((res) => {
          dbErr('save attendance', get().notify)(res)
          if (already && !res.error) get().notify('Note: today’s attendance was already marked — it has been updated')
          // Re-pull so the Students list shows the new attendance % right away,
          // instead of staying stale until the next focus/manual refresh.
          if (!res.error) get().refreshData()
        })
      })
    }
    // Tell only the absent students (their parents watch these devices).
    const absent = roster.filter((s, i) => att[i] === 'absent' && !!s?.dbId)
    if (absent.length) {
      const rows = absent.map(s => ({ student_id: s.dbId, title: 'Marked absent today', detail: `${s.name} was marked absent. Please contact the centre if this is a mistake.`, icon: 'absence' }))
      supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
      const codes = absent.map(s => s.id).filter(Boolean)
      if (codes.length) sendPush({ studentCodes: codes, title: 'Marked absent today', body: 'Your ward was marked absent at the centre today.' }).then(() => {})
    }
    get().notify(`Attendance saved · ${roster.length - Object.values(att).filter(v => v === 'absent').length} present`)
  },
})
