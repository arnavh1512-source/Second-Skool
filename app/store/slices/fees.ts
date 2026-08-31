import { supabase } from '../../lib/supabase'
import { indexOfStudent } from '../../lib/student-key'
import { dbErr, NOT_SAVED } from '../db'
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
// So every pair now happens inside one database transaction, and fee_status is
// derived there from the rows that actually exist. Collecting and reopening
// went first, in migration 0030; adding and deleting followed in 0034, because
// until then those three still committed the fee row and only then asked for
// the badge — the same gap, on the paths that create the money rather than
// collect it. Six functions, one shape: add_fee, add_fee_plan, delete_fee,
// delete_fee_plan, mark_fees_paid, reopen_fees_today. Each locks the student
// row before touching anything, so two people working on the same child at the
// same moment queue rather than overwrite. The browser's job is down to asking
// for the change and reporting what came back.
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

    const res = await supabase.rpc('add_fee', {
      p_student_id: studentDbId, p_amount: amount, p_period: period, p_due_date: dueDate,
    })
    if (res.error) { set({ students: before }); dbErr('add the fee', notify)(res); return false }
    // Nothing was written if the student could not be locked — deleted in
    // another session, or in a centre this head may not touch. The whole call
    // rolled back with it, so rolling the badge back here is the truth.
    if (!syncedStudent(res.data)) { set({ students: before }); notify(NOT_SAVED, 'error'); return false }

    notify('Fee record added')
    await get().refreshData()
    return true
  },

  // A plan is written as ordinary fee rows sharing one plan_id. Six installments
  // are one call, not six round trips — a partial plan (three rows in, three
  // lost to a dropped connection) would be worse than no plan, and one
  // transaction gives us all-or-nothing for free. The plan_id is the database's
  // to choose; nothing out here needs to know it before the rows exist.
  addFeePlan: async (studentDbId, installments) => {
    const notify = get().notify
    if (!studentDbId) { notify('Choose a student before setting up a plan', 'error'); return false }
    if (installments.length === 0) { notify('That plan has no installments', 'error'); return false }
    if (!get().online) { notify('No internet — the plan has NOT been created. Try again once you are back online.', 'error'); return false }

    const total = installments.reduce((n, i) => n + i.amount, 0)

    const before = get().students
    const idx = before.findIndex(s => s.dbId === studentDbId)
    if (idx >= 0) {
      const arr = [...before]
      arr[idx] = { ...arr[idx], feeStatus: 'Due', feeDue: (arr[idx].feeDue ?? 0) + total }
      set({ students: arr })
    }

    const res = await supabase.rpc('add_fee_plan', {
      p_student_id: studentDbId,
      p_installments: installments.map(i => ({ amount: i.amount, period: i.period, due_date: i.dueDate })),
    })
    if (res.error) { set({ students: before }); dbErr('create the fee plan', notify)(res); return false }
    if (!syncedStudent(res.data)) { set({ students: before }); notify(NOT_SAVED, 'error'); return false }

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

    const res = await supabase.rpc('delete_fee_plan', { p_plan_id: planId, p_student_id: studentDbId })
    const rollback = () => set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before } }))
    if (res.error) { rollback(); dbErr('remove the fee plan', notify)(res); return }
    // Zero rows is a teacher's delete filtered out by RLS, or a plan someone
    // else removed first. Either way nothing changed, including the badge.
    if (!syncedStudent(res.data)) { rollback(); notify(NOT_SAVED, 'error'); return }

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

    // Report what the database settled on, not what the tap asked for. Reopening
    // a student whose fees were all collected in earlier months reopens nothing
    // — correctly — and the badge stays Paid. Saying "Due" there would be the
    // toast agreeing with an optimistic guess the DB has already overruled.
    notify(`${student.name}: ${settledStatus(res.data) ?? newStatus}`)
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
  // filtered out by RLS and returns a silent zero-row success, which is what
  // the row counts coming back from delete_fee are here to catch.
  deleteFee: async (feeId, studentDbId) => {
    const notify = get().notify
    if (!get().online) { notify('No internet — the fee has NOT been removed. Try again once you are back online.', 'error'); return }

    const before = get().feeRecords[studentDbId] ?? []
    set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before.filter(f => f.dbId !== feeId) } }))

    // The badge is a column, not a total, so a delete on its own would leave a
    // student reading "Due" with nothing left owing. delete_fee recomputes it
    // from what remains, in the same transaction as the delete.
    const res = await supabase.rpc('delete_fee', { p_fee_id: feeId })
    const rollback = () => set(s => ({ feeRecords: { ...s.feeRecords, [studentDbId]: before } }))
    if (res.error) { rollback(); dbErr('remove the fee', notify)(res); return }
    if (!syncedStudent(res.data)) { rollback(); notify(NOT_SAVED, 'error'); return }

    notify('Fee record removed')
    await get().refreshData()
  },
})

// Every fee function reports how many student rows it touched. Zero means the
// write did not happen — the student was not there to lock, or RLS filtered the
// change away — and because the whole function is one transaction, zero here
// means nothing at all changed. PostgREST would otherwise hand that back as a
// cheerful success. Same job changedNothing() does for a plain write.
const syncedStudent = (data: unknown): boolean =>
  Number((data as { student?: unknown } | null)?.student ?? 0) > 0

// The badge the database actually wrote. Only the toggle needs it — every other
// path already knows the answer it asked for — and refreshData() reconciles the
// roster a moment later regardless, so a shape we do not recognise is a reason
// to fall back rather than to fail.
const settledStatus = (data: unknown): FeeStatus | null => {
  const s = (data as { status?: unknown } | null)?.status
  return s === 'Paid' || s === 'Due' || s === 'Overdue' ? s : null
}
