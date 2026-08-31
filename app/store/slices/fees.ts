import { supabase } from '../../lib/supabase'
import { indexOfStudent } from '../../lib/student-key'
import { changedNothing, dbErr, NOT_SAVED } from '../db'
import type { Slice } from '../slice'
import type { FeeRecord, FeeStatus } from '../types'

// Every money action here used to be two writes from the browser: change the
// fee rows, then change students.fee_status to match. Two writes, two
// transactions, and a gap in between that a dropped connection or a closed lid
// fits neatly into. The failure mode is not cosmetic — "marked Paid" is a
// receipt for cash that did or did not change hands, and a student left with
// paid rows and a Due badge is a family being asked for money twice.
//
// The second half was also a guess. fee_status was computed in the browser from
// whatever fee list this session happened to have loaded, which is a snapshot
// of the past; a fee added on the head's phone thirty seconds earlier is not in
// it, and the write confidently stamped it away.
//
// So the pairs now happen inside one database transaction each, and fee_status
// is derived there from the rows that actually exist — mark_fees_paid(),
// reopen_fees_today() and sync_fee_status(), all in migration 0030. Each takes
// a lock on the student row first, so two people touching the same child's fees
// at the same moment queue rather than overwrite. The browser's job is down to
// asking for the change and reporting what came back.
//
// The optimistic update stays — the badge must move the instant she taps — but
// it is rolled back when the write fails, and success is only claimed once the
// write lands.
export const createFeesSlice: Slice<'addFee' | 'addFeePlan' | 'deleteFeePlan' | 'toggleFeeStatus' | 'loadStudentFees' | 'deleteFee'> = (set, get) => ({
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
    const r2 = await supabase.rpc('sync_fee_status', { p_student_id: studentDbId })
    if (r2.error) { dbErr('update the fee status', notify)(r2); await get().refreshData(); return true }
    // The student row must exist — a fee was just inserted against it. Zero
    // rows means the roster moved under us, and the badge is now wrong.
    if (!syncedStudent(r2.data)) { notify('Fee saved, but the status badge did not update — refresh to see it', 'error'); await get().refreshData(); return true }

    notify('Fee record added')
    await get().refreshData()
    return true
  },

  // A plan is written as ordinary fee rows sharing one plan_id. Six installments
  // are one insert, not six round trips — a partial plan (three rows in, three
  // lost to a dropped connection) would be worse than no plan, and Postgres
  // gives us all-or-nothing for free on a single statement.
  addFeePlan: async (studentDbId, installments) => {
    const notify = get().notify
    if (!studentDbId) { notify('Choose a student before setting up a plan', 'error'); return false }
    if (installments.length === 0) { notify('That plan has no installments', 'error'); return false }
    if (!get().online) { notify('No internet — the plan has NOT been created. Try again once you are back online.', 'error'); return false }

    const planId = crypto.randomUUID()
    const total = installments.reduce((n, i) => n + i.amount, 0)

    const before = get().students
    const idx = before.findIndex(s => s.dbId === studentDbId)
    if (idx >= 0) {
      const arr = [...before]
      arr[idx] = { ...arr[idx], feeStatus: 'Due', feeDue: (arr[idx].feeDue ?? 0) + total }
      set({ students: arr })
    }

    const r1 = await supabase.from('fees').insert(installments.map(i => ({
      student_id: studentDbId, plan_id: planId,
      amount: i.amount, period: i.period, due_date: i.dueDate, status: 'Due',
    })))
    if (r1.error) { set({ students: before }); dbErr('create the fee plan', notify)(r1); return false }

    // The rows are committed by here, so a failure below is a stale badge and
    // not a lost plan — say so, but do not roll the plan back.
    const r2 = await supabase.rpc('sync_fee_status', { p_student_id: studentDbId })
    if (r2.error) { dbErr('update the fee status', notify)(r2); await get().refreshData(); return true }
    if (!syncedStudent(r2.data)) { notify('Plan saved, but the status badge did not update — refresh to see it', 'error'); await get().refreshData(); return true }

    // The open breakdown was fetched before these rows existed. Without this the
    // head watches a success toast and an unchanged list.
    if (get().feeRecords[studentDbId]) await get().loadStudentFees(studentDbId)
    notify(`${installments.length} installments added`)
    await get().refreshData()
    return true
  },

  // The one thing plan_id buys: a plan set up against the wrong child, or with
  // the wrong total, comes off in a single confirmation. Only the unpaid rows
  // go — an installment already collected is money that changed hands, and
  // deleting it would quietly erase it from the fees-collected report.
  deleteFeePlan: async (planId, studentDbId) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the plan has NOT been removed. Try again once you are back online.', 'error'); return }

    const before = get().feeRecords[studentDbId] ?? []
    const doomed = before.filter(f => f.planId === planId && f.status !== 'Paid')
    if (doomed.length === 0) { notify('Every installment in that plan is already paid', 'error'); return }
    set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before.filter(f => !doomed.includes(f)) } }))

    const res = await supabase.from('fees').delete()
      .eq('plan_id', planId).eq('student_id', studentDbId).neq('status', 'Paid').select('id')
    if (res.error) { set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before } })); dbErr('remove the fee plan', notify)(res); return }
    if (changedNothing(res)) { set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before } })); notify(NOT_SAVED, 'error'); return }

    // Same reason as deleteFee: fee_status is a stored column, so it has to be
    // recomputed from what is actually left or the family keeps the Due badge.
    const upd = await supabase.rpc('sync_fee_status', { p_student_id: studentDbId })
    if (upd.error || !syncedStudent(upd.data)) {
      notify('Plan removed, but the status badge did not update — refresh to see it', 'error')
      await get().refreshData()
      return
    }

    notify(`${doomed.length} unpaid installments removed`)
    await get().refreshData()
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

    // Marking Paid clears every outstanding row; reopening touches ONLY fees
    // marked paid today, which is the undo for a mis-tap. Historical paid months
    // must never flip back — that would corrupt fee history and the
    // fees-collected report — and the date is decided by the database rather
    // than by whatever the phone thinks the day is.
    const res = await supabase.rpc(newStatus === 'Paid' ? 'mark_fees_paid' : 'reopen_fees_today', { p_student_id: dbId })
    if (res.error) { set({ students: before }); dbErr('change the fee status', notify)(res); return }
    // This write marks money paid. A student deleted in another session, or a
    // row this session may not touch, comes back as a silent success — and the
    // head walks away believing a fee was collected. Roll the badge back.
    if (!syncedStudent(res.data)) { set({ students: before }); notify(NOT_SAVED, 'error'); return }

    notify(`${student.name}: ${newStatus}`)
    await get().refreshData()
  },

  // A balance is a total; it never said what it was made of. A parent asking
  // why they owe 2,001 rupees could not be answered from this app, and the
  // head could not see that 1 of it was a fee typed by mistake. Fetched per
  // student, on open.
  loadStudentFees: async (studentDbId) => {
    const { data, error } = await supabase.from('fees')
      .select('id, period, amount, due_date, status, plan_id')
      .eq('student_id', studentDbId).order('due_date', { ascending: false }).limit(100)
    if (error) { dbErr('load the fee records', get().notify)({ error }); return }
    const rows: FeeRecord[] = (data ?? []).map(f => ({
      dbId: f.id as string,
      period: (f.period as string) ?? '',
      amount: Number(f.amount) || 0,
      dueDate: (f.due_date as string) ?? '',
      status: ((f.status as FeeStatus) ?? 'Due'),
      planId: (f.plan_id as string) ?? null,
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
    const upd = await supabase.rpc('sync_fee_status', { p_student_id: studentDbId })
    if (upd.error || !syncedStudent(upd.data)) {
      notify('Fee removed, but the status badge did not update — refresh to see it', 'error')
      await get().refreshData()
      return
    }

    notify('Fee record removed')
    await get().refreshData()
  },
})

// All three fee functions report how many student rows they touched. Zero means
// the student was not there to lock — deleted in another session, or behind an
// RLS policy this user does not satisfy — which PostgREST would otherwise hand
// back as a cheerful success. Same job changedNothing() does for a plain write.
const syncedStudent = (data: unknown): boolean =>
  Number((data as { student?: unknown } | null)?.student ?? 0) > 0
