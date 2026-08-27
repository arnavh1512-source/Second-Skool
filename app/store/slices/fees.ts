import { supabase } from '../../lib/supabase'
import { indexOfStudent } from '../../lib/student-key'
import { changedNothing, dbErr, NOT_SAVED } from '../db'
import { isoDay } from '../format'
import type { Slice } from '../slice'
import type { FeeRecord, FeeStatus } from '../types'

// students.fee_status is a stored column, not a total, so it does not move
// when a fee row disappears. Deleting a child's only outstanding fee left the
// balance at zero and the badge still reading "Due" — the head had removed the
// mistake and the roster still accused the family of owing money.
//
// Paid is what this app already means by "nothing outstanding": addFee sets
// Due, and toggleFeeStatus sets Paid once the due rows are cleared. A student
// with no fee records at all reads Paid for the same reason.
export const feeStatusAfter = (remaining: FeeRecord[]): FeeStatus =>
  remaining.some(f => f.status !== 'Paid') ? 'Due' : 'Paid'

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
export const createFeesSlice: Slice<'addFee' | 'toggleFeeStatus' | 'loadStudentFees' | 'deleteFee'> = (set, get) => ({
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
    const r2 = await supabase.from('students').update({ fee_status: 'Due' }).eq('id', studentDbId).select('id')
    if (r2.error) { dbErr('update the fee status', notify)(r2); await get().refreshData(); return true }
    // The student row must exist — a fee was just inserted against it. Zero
    // rows means the roster moved under us, and the badge is now wrong.
    if (changedNothing(r2)) { notify('Fee saved, but the status badge did not update — refresh to see it', 'error'); await get().refreshData(); return true }

    notify('Fee record added')
    await get().refreshData()
    return true
  },

  // Keyed on the student, not their slot. The badge is rendered from a
  // filtered, sorted copy of the roster and the roster is re-fetched on every
  // focus, so the position captured at render time routinely belongs to a
  // different child by the time the head's finger lands — and this write marks
  // fees paid.
  toggleFeeStatus: async (key) => {
    const notify = get().notify
    const before = get().students
    const idx = indexOfStudent(before, key)
    const student = before[idx]
    if (!student) { notify('That student is no longer on the roster', 'error'); return }
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

    const r1 = await supabase.from('students').update({ fee_status: newStatus }).eq('id', dbId).select('id')
    if (r1.error) { set({ students: before }); dbErr('change the fee status', notify)(r1); return }
    // This write marks money paid. A student deleted in another session, or a
    // row this session may not touch, comes back as a silent success — and the
    // head walks away believing a fee was collected. Roll the badge back.
    if (changedNothing(r1)) { set({ students: before }); notify(NOT_SAVED, 'error'); return }

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

  // A balance is a total; it never said what it was made of. A parent asking
  // why they owe 2,001 rupees could not be answered from this app, and the
  // head could not see that 1 of it was a fee typed by mistake. Fetched per
  // student, on open.
  loadStudentFees: async (studentDbId) => {
    const { data, error } = await supabase.from('fees')
      .select('id, period, amount, due_date, status')
      .eq('student_id', studentDbId).order('due_date', { ascending: false }).limit(100)
    if (error) { dbErr('load the fee records', get().notify)({ error }); return }
    const rows: FeeRecord[] = (data ?? []).map(f => ({
      dbId: f.id as string,
      period: (f.period as string) ?? '',
      amount: Number(f.amount) || 0,
      dueDate: (f.due_date as string) ?? '',
      status: ((f.status as FeeStatus) ?? 'Due'),
    }))
    set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: rows } }))
  },

  // Money records were the one thing this app could create and never take
  // back. A fee typed with the wrong amount, or against the wrong child, sat
  // on that family's balance permanently — and the only way to clear it was to
  // mark it Paid, which records money nobody ever handed over. Head-only,
  // because fees_head is the policy that permits it: a teacher's delete is
  // filtered out by RLS and returns PostgREST's silent zero-row success, which
  // is exactly what changedNothing is here to catch.
  deleteFee: async (feeId, studentDbId) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the fee has NOT been removed. Try again once you are back online.', 'error'); return }

    const before = get().feeRecords[studentDbId] ?? []
    set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before.filter(f => f.dbId !== feeId) } }))

    const res = await supabase.from('fees').delete().eq('id', feeId).select('id')
    if (res.error) { set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before } })); dbErr('remove the fee', notify)(res); return }
    if (changedNothing(res)) { set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before } })); notify(NOT_SAVED, 'error'); return }

    // The badge is a column, not a total, so refreshData alone would leave a
    // student reading "Due" with nothing left owing. Recompute it from what
    // actually remains — and if that write fails the fee is still gone, so
    // say so rather than rolling back a delete that already happened.
    const status = feeStatusAfter(get().feeRecords[studentDbId] ?? [])
    const upd = await supabase.from('students').update({ fee_status: status }).eq('id', studentDbId).select('id')
    if (upd.error || changedNothing(upd)) {
      notify('Fee removed, but the status badge did not update — refresh to see it', 'error')
      await get().refreshData()
      return
    }

    notify('Fee record removed')
    await get().refreshData()
  },
})
