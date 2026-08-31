'use client'

import { useState } from 'react'
import { indexOfStudent, studentKey } from '../lib/student-key'
import { useDashboard, REMINDER_TEMPLATES, initials, av, feeColor, parseDay, rupee, isoDay, LIMITS, clampText } from '../store'
import { PLAN_INTERVALS, isOverdue, splitPlan, summariseFees, validatePlan, type PlanInterval } from '../lib/fee-plan'
import { ScreenHeader, PrimaryButton, EmptyState, ConfirmDialog } from './Shell'

// Due dates are parsed as calendar parts, not as instants: "5 Oct" is a day on
// a wall calendar and must not slide to the 4th because of a timezone.
const fmtDue = (iso: string) =>
  parseDay(iso)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ?? ''

export function FeesScreen() {
  const { students, back, notify, addFee, addFeePlan, deleteFeePlan, toggleFeeStatus, saveReminder, go, role, feeRecords, loadStudentFees, deleteFee } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [selStudent, setSelStudent] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')
  // One fee or a whole year of them. The plan side asks for five numbers once
  // instead of five numbers a month, which is the only reason it is here.
  const [planMode, setPlanMode] = useState(false)
  const [planTotal, setPlanTotal] = useState('')
  const [planDiscount, setPlanDiscount] = useState('')
  const [planCount, setPlanCount] = useState('6')
  const [planFirstDue, setPlanFirstDue] = useState('')
  const [planInterval, setPlanInterval] = useState<PlanInterval>('monthly')
  // Which student's fee breakdown is open, and which single fee is one
  // confirmation away from being removed. One at a time: this is a list of
  // balances, not a ledger, and expanding everything would fetch the whole
  // centre's fee history to answer a question about one child.
  const [openFees, setOpenFees] = useState<string | null>(null)
  const [confirmFee, setConfirmFee] = useState<{ id: string; studentId: string; student: string; label: string } | null>(null)
  const [confirmPlan, setConfirmPlan] = useState<{ planId: string; studentId: string; student: string; count: number } | null>(null)
  const today = isoDay()
  const isAdmin = role === 'admin'
  const paidCount = students.filter(s => s.feeStatus === 'Paid').length
  const pendingCount = students.length - paidCount
  const totalCollected = students.reduce((n, s) => n + (s.feeCollected ?? 0), 0)
  const totalRemaining = students.reduce((n, s) => n + (s.feeDue ?? 0), 0)
  const rows = [...students.filter(d => d.feeStatus !== 'Paid'), ...students.filter(d => d.feeStatus === 'Paid')]

  const handleAdd = async () => {
    if (!selStudent) { notify('Select a student', 'error'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { notify('Enter a valid amount', 'error'); return }
    // fees.amount is numeric(10,2), so anything larger used to be rejected by
    // Postgres with an error the head never saw — the form just sat there.
    if (amt > LIMITS.feeAmount) { notify(`Amount cannot exceed ₹${LIMITS.feeAmount.toLocaleString('en-IN')}`, 'error'); return }
    if (!period.trim()) { notify('Enter the fee period', 'error'); return }
    if (!dueDate) { notify('Select a due date', 'error'); return }
    if (!(await addFee(selStudent, amt, clampText(period, LIMITS.period), dueDate))) return
    setSelStudent(''); setAmount(''); setPeriod(''); setDueDate(''); setShowForm(false)
  }

  const planDraft = {
    total: Number(planTotal), discount: Number(planDiscount) || 0,
    count: Number(planCount), firstDue: planFirstDue, interval: planInterval,
  }
  // The head is committing to a year of demands on a family from four inputs,
  // so the exact rupees and the exact months are on screen before Save is
  // pressed, not discovered afterwards in the breakdown.
  const planPreview = splitPlan(planDraft)

  const handleAddPlan = async () => {
    if (!selStudent) { notify('Select a student', 'error'); return }
    const problem = validatePlan(planDraft, LIMITS.feeAmount)
    if (problem) { notify(problem, 'error'); return }
    if (!(await addFeePlan(selStudent, planPreview))) return
    setSelStudent(''); setPlanTotal(''); setPlanDiscount(''); setPlanCount('6'); setPlanFirstDue(''); setShowForm(false)
  }

  return (
    <div className="td-wide td-screen">
      <ConfirmDialog
        open={!!confirmFee}
        title="Remove this fee record?"
        body={`${confirmFee?.label ?? ''} comes off ${confirmFee?.student ?? ''}'s balance for good. Use this for a record entered by mistake — marking it Paid instead would record money you never collected.`}
        confirmLabel="Remove fee"
        onConfirm={() => { const t = confirmFee; setConfirmFee(null); if (t) deleteFee(t.id, t.studentId) }}
        onCancel={() => setConfirmFee(null)}
      />
      <ConfirmDialog
        open={!!confirmPlan}
        title="Remove the rest of this plan?"
        body={`${confirmPlan?.count ?? 0} unpaid installments come off ${confirmPlan?.student ?? ''}'s balance for good. Installments already marked Paid stay — that money was collected, and removing it would erase it from your fees report.`}
        confirmLabel="Remove installments"
        onConfirm={() => { const t = confirmPlan; setConfirmPlan(null); if (t) deleteFeePlan(t.planId, t.studentId) }}
        onCancel={() => setConfirmPlan(null)}
      />
      <ScreenHeader title="Fees" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="td-btn-sm">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add fee'}
        </button>
      } />

      <div className="flex gap-2.5 mb-[18px] lg:max-w-md">
        <div className="flex-1 bg-td-tint-green rounded-2xl p-3.5">
          <div className="text-[21px] font-extrabold text-td-green leading-tight">{rupee(totalCollected)}</div>
          <div className="text-[12px] text-td-on-green font-semibold mt-[3px]">Collected · {paidCount} paid</div>
        </div>
        <div className="flex-1 bg-td-tint-red rounded-2xl p-3.5">
          <div className="text-[21px] font-extrabold text-td-red leading-tight">{rupee(totalRemaining)}</div>
          <div className="text-[12px] text-td-on-red font-semibold mt-[3px]">Remaining · {pendingCount} pending</div>
        </div>
      </div>

      {showForm && (
        <div className="td-form-card mb-[18px] lg:max-w-lg">
          <div className="flex gap-1.5 p-1 bg-td-soft rounded-[14px]">
            {[{ on: false, label: 'One fee' }, { on: true, label: 'Installment plan' }].map(t => (
              <button key={t.label} onClick={() => setPlanMode(t.on)}
                className={`flex-1 text-[12.5px] font-bold py-2 rounded-[10px] border-none cursor-pointer ${planMode === t.on ? 'bg-td-card text-td-dark' : 'bg-transparent text-td-muted'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div><label className="td-label">Student</label>
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className="td-field text-[13.5px] bg-td-card">
              <option value="">Select student</option>
              {students.map(s => <option key={s.dbId ?? s.id} value={s.dbId ?? ''}>{s.name} — {s.klass}</option>)}
            </select>
          </div>
          {!planMode ? (
            <>
              <div className="grid grid-cols-2 gap-[11px]">
                <div><label className="td-label">Amount (&#8377;)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" className="td-field text-sm" />
                </div>
                <div><label className="td-label">Period</label>
                  <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. July 2026" className="td-field text-sm" />
                </div>
              </div>
              <div><label className="td-label">Due date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="td-field text-sm" />
              </div>
              <PrimaryButton onClick={handleAdd}>Add fee record</PrimaryButton>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-[11px]">
                <div><label className="td-label">Total for the year (&#8377;)</label>
                  <input type="number" value={planTotal} onChange={e => setPlanTotal(e.target.value)} placeholder="e.g. 12000" className="td-field text-sm" />
                </div>
                <div><label className="td-label">Discount (&#8377;)</label>
                  <input type="number" value={planDiscount} onChange={e => setPlanDiscount(e.target.value)} placeholder="0" className="td-field text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[11px]">
                <div><label className="td-label">Installments</label>
                  <input type="number" value={planCount} onChange={e => setPlanCount(e.target.value)} placeholder="6" className="td-field text-sm" />
                </div>
                <div><label className="td-label">Every</label>
                  <select value={planInterval} onChange={e => setPlanInterval(e.target.value as PlanInterval)} className="td-field text-[13.5px] bg-td-card">
                    {PLAN_INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="td-label">First due date</label>
                <input type="date" value={planFirstDue} onChange={e => setPlanFirstDue(e.target.value)} className="td-field text-sm" />
              </div>
              {planPreview.length > 0 && (
                <div className="bg-td-soft rounded-[14px] p-3 text-[12px] text-td-muted leading-relaxed">
                  <span className="td-strong text-td-dark">{planPreview.length} installments</span>
                  {' · '}{planPreview[0].period} to {planPreview[planPreview.length - 1].period}
                  <div className="mt-1">
                    First {rupee(planPreview[0].amount)}, then {rupee(planPreview[planPreview.length - 1].amount)} each.
                  </div>
                </div>
              )}
              <PrimaryButton onClick={handleAddPlan}>Create plan</PrimaryButton>
            </>
          )}
        </div>
      )}

      <button onClick={() => { if (pendingCount === 0) { notify('No pending fees', 'error'); return } saveReminder('Fee', REMINDER_TEMPLATES.Fee, 'all', 'fees_due') }} className="w-full lg:max-w-md border border-td-red bg-td-card text-td-red text-sm font-extrabold p-[13px] rounded-[14px] cursor-pointer mb-[18px]">Send alert to all pending</button>

      {rows.length === 0 ? (
        <EmptyState
          title="No students yet"
          hint="Fees are tracked per student, so there is nothing to collect until you have added some."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <div className="td-list gap-2.5">
          {rows.map(d => {
            const realIdx = indexOfStudent(students, studentKey(d))
            const f = feeColor(d.feeStatus)
            const open = !!d.dbId && openFees === d.dbId
            const records = d.dbId ? feeRecords[d.dbId] : undefined
            return (
              <div key={d.id} className="td-card rounded-2xl p-[13px] px-3.5">
                <div className="flex items-center gap-[13px]">
                  <div className="w-10 h-10 rounded-xl td-avatar" style={{ background: av(realIdx) }}>{initials(d.name)}</div>
                  {/* The balance was a total with nothing behind it. Tapping the
                      name now opens what it is made of — which is also the only
                      place a fee can be taken back off it. */}
                  <button onClick={() => { if (!d.dbId) return; const next = open ? null : d.dbId; setOpenFees(next); if (next && !feeRecords[next]) loadStudentFees(next) }} className="td-plain flex-1 min-w-0 text-left p-0 cursor-pointer">
                    <div className="text-[13.5px] font-bold text-td-dark truncate">{d.name}</div>
                    <div className="text-xs text-td-muted mt-0.5">
                      {d.klass}
                      {(d.feeDue ?? 0) > 0 && <span className="text-td-red font-semibold"> · {rupee(d.feeDue!)} due</span>}
                      {(d.feeDue ?? 0) === 0 && (d.feeCollected ?? 0) > 0 && <span className="text-td-green font-semibold"> · {rupee(d.feeCollected!)} paid</span>}
                    </div>
                  </button>
                  <button onClick={() => toggleFeeStatus(studentKey(d))} className="text-[12px] font-bold py-[5px] px-2.5 rounded-[20px] border-none cursor-pointer shrink-0" style={{ color: f.c, background: f.b }}>{d.feeStatus}</button>
                </div>

                {open && (
                  <div className="mt-3 pt-3 border-t border-td-border flex flex-col gap-2">
                    {records === undefined ? (
                      <div className="text-xs text-td-muted">Loading fee records...</div>
                    ) : records.length === 0 ? (
                      <div className="text-xs text-td-muted">No fee records for {d.name} yet.</div>
                    ) : (() => {
                      const sum = summariseFees(records, today)
                      // Distinct plans with something still unpaid. Almost always
                      // one; the list is here because a child can be moved onto a
                      // new plan mid-year without the old one being cleared first.
                      const openPlans = [...new Set(records.filter(r => r.planId && r.status !== 'Paid').map(r => r.planId!))]
                      return (
                        <>
                          {/* A column of rows never answered "how far through is
                              this family?" — the question every fee conversation
                              actually starts with. */}
                          {records.length > 1 && (
                            <div className="text-[11.5px] text-td-muted leading-relaxed pb-1">
                              <span className="td-strong text-td-dark">{rupee(sum.total)}</span>
                              {` · ${sum.paidCount} of ${sum.count} paid`}
                              {sum.outstanding > 0 && ` · ${rupee(sum.outstanding)} outstanding`}
                              {sum.next?.dueDate && ` · next ${rupee(sum.next.amount)} due ${fmtDue(sum.next.dueDate)}`}
                              {sum.overdueCount > 0 && <span className="text-td-red font-semibold"> · {sum.overdueCount} overdue</span>}
                            </div>
                          )}
                          {records.map(r => {
                            const late = isOverdue(r, today)
                            const label = `${rupee(r.amount)} · ${r.period}`
                            return (
                              <div key={r.dbId} className="flex items-center gap-2.5">
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12.5px] font-bold text-td-dark truncate">{label}</div>
                                  <div className={`text-[11.5px] mt-px ${late ? 'text-td-red font-semibold' : 'text-td-muted'}`}>
                                    {r.status === 'Paid' ? 'Paid' : late ? 'Overdue' : 'Due'}
                                    {r.dueDate && ` · ${fmtDue(r.dueDate)}`}
                                  </div>
                                </div>
                                {isAdmin && (
                                  <button onClick={() => setConfirmFee({ id: r.dbId, studentId: d.dbId!, student: d.name, label })} className="shrink-0 td-danger text-[11.5px] font-bold py-1 px-2.5 rounded-[10px]">Remove</button>
                                )}
                              </div>
                            )
                          })}
                          {isAdmin && openPlans.map(planId => (
                            <button key={planId}
                              onClick={() => setConfirmPlan({ planId, studentId: d.dbId!, student: d.name, count: records.filter(r => r.planId === planId && r.status !== 'Paid').length })}
                              className="mt-1 self-start td-danger text-[11.5px] font-bold py-1 px-2.5 rounded-[10px]">
                              Remove the rest of this plan
                            </button>
                          ))}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
