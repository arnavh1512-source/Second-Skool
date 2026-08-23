import { supabase } from '../../lib/supabase'
import { dbErr } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { FeeStatus } from '../types'

// Both actions here write money records, and both used to update the list and
// toast success in the same tick they fired the write. "Fee record added" and
// "Rahul: Paid" appeared whether or not the row ever reached Postgres, so on a
// dropped connection a head believed a fee was collected, saw the badge agree,
// and then watched the next refresh silently revert it with no explanation.
//
// The optimistic update stays — the badge must move the instant she taps — but
// it is now rolled back when the write fails, and success is only claimed once
// the write lands. This is the same fix f601d39 applied to nine actions; this
// file was never opened by that pass or the one after it.
export const createFeesSlice: Slice<'addFee' | 'toggleFeeStatus'> = (set, get) => ({
  addFee: async (studentDbId, amount, period, dueDate) => {
    const notify = get().notify
    if (!studentDbId) { notify('Choose a student before adding a fee', 'error'); return false }
    if (!get().online) { notify('No internet — the fee has NOT been added. Try again once you are back online.', 'error'); return false }

    const before = get().students
    const idx = before.findIndex(s => s.dbId === studentDbId)
    if (idx >= 0) {
      const arr = [...before]
      arr[idx] = { ...arr[idx], feeStatus: 'Due', feeDue: (arr[idx].feeDue ?? 0) + amount }
      set({ students: arr })
    }

    const r1 = await supabase.from('fees').insert({ student_id: studentDbId, amount, period, due_date: dueDate, status: 'Due' })
    if (r1.error) { set({ students: before }); dbErr('add the fee', notify)(r1); return false }

    // The fee row is committed at this point, so a failure here is a mismatched
    // badge rather than a lost record — report it, but do not roll the fee back.
    const r2 = await supabase.from('students').update({ fee_status: 'Due' }).eq('id', studentDbId)
    if (r2.error) { dbErr('update the fee status', notify)(r2); await get().refreshData(); return true }

    notify('Fee record added')
    await get().refreshData()
    return true
  },

  toggleFeeStatus: async (idx) => {
    const notify = get().notify
    const before = get().students
    const student = before[idx]
    if (!student) return
    const dbId = student.dbId
    if (!dbId) { notify('This student is not saved yet', 'error'); return }
    if (!get().online) { notify('No internet — the fee status has NOT been changed. Try again once you are back online.', 'error'); return }

    const newStatus: FeeStatus = student.feeStatus === 'Paid' ? 'Due' : 'Paid'
    // Optimistic: flip the badge and, when marking Paid, move outstanding due
    // into collected so the totals move instantly. refreshData() below then
    // reconciles the amounts against the DB (source of truth for the reopen case).
    const arr = [...before]
    arr[idx] = newStatus === 'Paid'
      ? { ...student, feeStatus: newStatus, feeCollected: (student.feeCollected ?? 0) + (student.feeDue ?? 0), feeDue: 0 }
      : { ...student, feeStatus: newStatus }
    set({ students: arr })

    const r1 = await supabase.from('students').update({ fee_status: newStatus }).eq('id', dbId)
    if (r1.error) { set({ students: before }); dbErr('change the fee status', notify)(r1); return }

    if (newStatus === 'Paid') {
      const r2 = await supabase.from('fees').update({ status: 'Paid', paid_date: isoDay() })
        .eq('student_id', dbId).eq('status', 'Due')
      if (r2.error) { dbErr('mark the fees paid', notify)(r2); await get().refreshData(); return }
    } else {
      // Reopen ONLY fees marked paid today (undo for a mis-tap). Historical
      // paid months must never flip back — that would corrupt fee history
      // and the fees-collected report.
      const today = isoDay()
      const r2 = await supabase.from('fees').update({ status: 'Due', paid_date: null })
        .eq('student_id', dbId).eq('status', 'Paid').eq('paid_date', today)
      if (r2.error) { dbErr('reopen the fees', notify)(r2); await get().refreshData(); return }
    }

    notify(`${student.name}: ${newStatus}`)
    await get().refreshData()
  },
})
