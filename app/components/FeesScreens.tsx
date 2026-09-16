'use client'

import { useState } from 'react'
import { studentKey } from '../lib/student-key'
import { useDashboard, REMINDER_TEMPLATES, parseDay, rupee, isoDay, LIMITS, clampText } from '../store'
import { PLAN_INTERVALS, isOverdue, splitPlan, summariseFees, validatePlan, type PlanInterval } from '../lib/fee-plan'
import { ScreenHeader, PrimaryButton, EmptyState, ConfirmDialog, Chip, classesOf } from './Shell'

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
  // Fees are chased one class at a time — a class shares a fee amount, a
  // parent group and usually a collection day. The two totals follow the chip
  // so "what is Class 10 still owing" is a tap, not arithmetic.
  const [klass, setKlass] = useState('')
  const classNames = classesOf(students)
  const today = isoDay()
  const isAdmin = role === 'admin'
  const inClass = klass ? students.filter(s => s.klass === klass) : students
  const paidCount = inClass.filter(s => s.feeStatus === 'Paid').length
  const pendingCount = inClass.length - paidCount
  const totalCollected = inClass.reduce((n, s) => n + (s.feeCollected ?? 0), 0)
  const totalRemaining = inClass.reduce((n, s) => n + (s.feeDue ?? 0), 0)
  const rows = [...inClass.filter(d => d.feeStatus !== 'Paid'), ...inClass.filter(d => d.feeStatus === 'Paid')]

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

      {classNames.length > 1 && (
        <div className="flex flex-wrap gap-[7px] mb-[18px]">
          <Chip active={!klass} onClick={() => setKlass('')}>All classes</Chip>
          {classNames.map(name => (
            <Chip key={name} active={name === klass} onClick={() => setKlass(name)}>{name}</Chip>
          ))}
        </div>
      )}

      {/* What is still owed leads; what came in is the line under it, and the
          bar shows the split without making her do the sum. */}
      <div className="bg-td-card border border-td-border p-4 mb-[18px] shadow-td-card lg:max-w-md">
        <div className="text-td-caption font-semibold tracking-[.12em] uppercase text-td-muted">Outstanding total</div>
        <div className="td-num text-[40px] leading-10 font-semibold tracking-[-.03em] text-td-on-red mt-[9px]">{rupee(totalRemaining)}</div>
        <div className="td-num text-td-small text-td-muted mt-2">{rupee(totalCollected)} collected of {rupee(totalCollected + totalRemaining)} · {pendingCount} pending, {paidCount} paid</div>
        {totalCollected + totalRemaining > 0 && (
          <div className="flex gap-0.5 h-2 mt-3" aria-hidden>
            {totalCollected > 0 && <div className="bg-td-green" style={{ flex: totalCollected }} />}
            {totalRemaining > 0 && <div className="bg-td-red" style={{ flex: totalRemaining }} />}
          </div>
        )}
      </div>

      {showForm && (
        <div className="td-form-card mb-[18px] lg:max-w-lg">
          <div className="flex gap-1.5 p-1 bg-td-soft rounded-td-md">
            {[{ on: false, label: 'One fee' }, { on: true, label: 'Installment plan' }].map(t => (
              <button key={t.label} onClick={() => setPlanMode(t.on)}
                className={`flex-1 text-td-caption font-semibold py-2 min-h-11 border-none cursor-pointer ${planMode === t.on ? 'bg-td-card text-td-dark' : 'bg-transparent text-td-muted'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="block"><span className="td-label">Student</span>
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className="td-field">
              <option value="">Select student</option>
              {students.map(s => <option key={s.dbId ?? s.id} value={s.dbId ?? ''}>{s.name} — {s.klass}</option>)}
            </select>
          </label>
          {!planMode ? (
            <>
              <div className="grid grid-cols-2 gap-[11px]">
                <label className="block"><span className="td-label">Amount (&#8377;)</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" className="td-field" />
                </label>
                <label className="block"><span className="td-label">Period</span>
                  <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. July 2026" className="td-field" />
                </label>
              </div>
              <label className="block"><span className="td-label">Due date</span>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="td-field" />
              </label>
              <PrimaryButton onClick={handleAdd}>Add fee record</PrimaryButton>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-[11px]">
                <label className="block"><span className="td-label">Total for the year (&#8377;)</span>
                  <input type="number" value={planTotal} onChange={e => setPlanTotal(e.target.value)} placeholder="e.g. 12000" className="td-field" />
                </label>
                <label className="block"><span className="td-label">Discount (&#8377;)</span>
                  <input type="number" value={planDiscount} onChange={e => setPlanDiscount(e.target.value)} placeholder="0" className="td-field" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-[11px]">
                <label className="block"><span className="td-label">Installments</span>
                  <input type="number" value={planCount} onChange={e => setPlanCount(e.target.value)} placeholder="6" className="td-field" />
                </label>
                <label className="block"><span className="td-label">Every</span>
                  <select value={planInterval} onChange={e => setPlanInterval(e.target.value as PlanInterval)} className="td-field">
                    {PLAN_INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block"><span className="td-label">First due date</span>
                <input type="date" value={planFirstDue} onChange={e => setPlanFirstDue(e.target.value)} className="td-field" />
              </label>
              {planPreview.length > 0 && (
                <div className="bg-td-soft rounded-td-md p-3 text-td-caption text-td-muted leading-relaxed">
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

      {/* The class the head is looking at is the class the alert goes to. A
          button that says "all pending" under a list showing one class would
          message families she never meant to chase. */}
      <button onClick={() => { if (pendingCount === 0) { notify('No pending fees', 'error'); return } saveReminder('Fee', REMINDER_TEMPLATES.Fee, klass || 'all', 'fees_due') }} className="w-full lg:max-w-md min-h-11 border border-td-red bg-td-card text-td-on-red text-td-small font-semibold p-[13px] cursor-pointer mb-[18px]">{klass ? `Send alert to pending in ${klass}` : 'Send alert to all pending'}</button>

      {rows.length === 0 && klass ? (
        <EmptyState title={`Nobody in ${klass}`} hint="No student in that class, so there is nothing to collect from it. Pick another class, or go back to all of them." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No students yet"
          hint="Fees are tracked per student, so there is nothing to collect until you have added some."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <div className="lg:max-w-2xl">
          <div className="td-h2 mb-0">{rows.length} {rows.length === 1 ? 'student' : 'students'}</div>
          {rows.map(d => {
            const tag = d.feeStatus === 'Paid' ? 'bg-td-tint-green text-td-on-green' : d.feeStatus === 'Overdue' ? 'bg-td-tint-red text-td-on-red' : 'bg-td-tint-amber text-td-on-amber'
            const open = !!d.dbId && openFees === d.dbId
            const records = d.dbId ? feeRecords[d.dbId] : undefined
            return (
              <div key={d.id} className="py-3 border-b border-td-line">
                <div className="flex items-center gap-3 min-h-11">
                  {/* The balance was a total with nothing behind it. Tapping the
                      name now opens what it is made of — which is also the only
                      place a fee can be taken back off it. */}
                  <button onClick={() => { if (!d.dbId) return; const next = open ? null : d.dbId; setOpenFees(next); if (next && !feeRecords[next]) loadStudentFees(next) }} className="td-plain flex-1 min-w-0 text-left p-0 cursor-pointer">
                    <div className="text-td-body font-semibold text-td-dark truncate">{d.name}</div>
                    <div className="text-td-small text-td-muted mt-px">{d.klass}</div>
                  </button>
                  <div className="shrink-0 text-right">
                    <div className="td-num text-td-body font-semibold text-td-dark">{rupee((d.feeDue ?? 0) > 0 ? d.feeDue! : d.feeCollected ?? 0)}</div>
                    <button onClick={() => toggleFeeStatus(studentKey(d))} aria-label={`${d.name}: ${d.feeStatus}, tap to change`} className={`td-tag mt-1 px-[7px] py-[3px] border-none cursor-pointer ${tag}`}>{d.feeStatus}</button>
                  </div>
                </div>

                {open && (
                  <div className="mt-3 pt-3 border-t border-td-line flex flex-col gap-2">
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
                            <div className="text-td-caption text-td-muted leading-relaxed pb-1">
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
                                  <div className="td-num text-td-caption font-semibold text-td-dark truncate">{label}</div>
                                  <div className={`text-td-caption mt-px ${late ? 'text-td-red font-semibold' : 'text-td-muted'}`}>
                                    {r.status === 'Paid' ? 'Paid' : late ? 'Overdue' : 'Due'}
                                    {r.dueDate && ` · ${fmtDue(r.dueDate)}`}
                                  </div>
                                </div>
                                {isAdmin && (
                                  <button onClick={() => setConfirmFee({ id: r.dbId, studentId: d.dbId!, student: d.name, label })} className="shrink-0 td-danger text-td-caption font-semibold py-1 px-2.5 min-h-11">Remove</button>
                                )}
                              </div>
                            )
                          })}
                          {isAdmin && openPlans.map(planId => (
                            <button key={planId}
                              onClick={() => setConfirmPlan({ planId, studentId: d.dbId!, student: d.name, count: records.filter(r => r.planId === planId && r.status !== 'Paid').length })}
                              className="mt-1 self-start td-danger text-td-caption font-semibold py-1 px-2.5 min-h-11">
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
