import { supabase } from '../../lib/supabase'
import { dbErr } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { FeeStatus } from '../types'

export const createFeesSlice: Slice<'addFee' | 'toggleFeeStatus'> = (set, get) => ({
  addFee: (studentDbId, amount, period, dueDate) => {
    const { students } = get()
    const idx = students.findIndex(s => s.dbId === studentDbId)
    if (idx >= 0) {
      const arr = [...students]
      arr[idx] = { ...arr[idx], feeStatus: 'Due', feeDue: (arr[idx].feeDue ?? 0) + amount }
      set({ students: arr })
    }
    get().notify('Fee record added')
    if (!studentDbId) return
    void (async () => {
      const notify = get().notify
      const r1 = await supabase.from('fees').insert({ student_id: studentDbId, amount, period, due_date: dueDate, status: 'Due' })
      dbErr('add fee', notify)(r1)
      const r2 = await supabase.from('students').update({ fee_status: 'Due' }).eq('id', studentDbId)
      dbErr('update fee status', notify)(r2)
      await get().refreshData()
    })()
  },

  toggleFeeStatus: (idx) => {
    const { students } = get()
    const student = students[idx]
    if (!student) return
    const newStatus: FeeStatus = student.feeStatus === 'Paid' ? 'Due' : 'Paid'
    // Optimistic: flip the badge and, when marking Paid, move outstanding due
    // into collected so the totals move instantly. refreshData() below then
    // reconciles the amounts against the DB (source of truth for the reopen case).
    const arr = [...students]
    arr[idx] = newStatus === 'Paid'
      ? { ...student, feeStatus: newStatus, feeCollected: (student.feeCollected ?? 0) + (student.feeDue ?? 0), feeDue: 0 }
      : { ...student, feeStatus: newStatus }
    set({ students: arr })
    get().notify(`${student.name}: ${newStatus}`)
    const dbId = student.dbId
    if (!dbId) return
    void (async () => {
      const notify = get().notify
      const r1 = await supabase.from('students').update({ fee_status: newStatus }).eq('id', dbId)
      dbErr('toggle fee', notify)(r1)
      if (newStatus === 'Paid') {
        const r2 = await supabase.from('fees').update({ status: 'Paid', paid_date: isoDay() })
          .eq('student_id', dbId).eq('status', 'Due')
        dbErr('mark fees paid', notify)(r2)
      } else {
        // Reopen ONLY fees marked paid today (undo for a mis-tap). Historical
        // paid months must never flip back — that would corrupt fee history
        // and the fees-collected report.
        const today = isoDay()
        const r2 = await supabase.from('fees').update({ status: 'Due', paid_date: null })
          .eq('student_id', dbId).eq('status', 'Paid').eq('paid_date', today)
        dbErr('reopen fees', notify)(r2)
      }
      await get().refreshData()
    })()
  },
})
