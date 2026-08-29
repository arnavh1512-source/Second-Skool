// Installment plans, and the two questions a fee list could never answer.
//
// Nothing here touches the database. A plan is turned into a list of ordinary
// fee rows before it ever reaches Postgres, so all of this is arithmetic on
// dates and rupees and can be tested without a network.

export type PlanInterval = 'monthly' | 'quarterly'

export const PLAN_INTERVALS: { value: PlanInterval; label: string; months: number }[] = [
  { value: 'monthly', label: 'Monthly', months: 1 },
  { value: 'quarterly', label: 'Quarterly', months: 3 },
]

// Two years of monthly installments. Past this the head is not planning a fee,
// they have mistyped one, and 200 rows against one child is not something the
// UI offers a way back from except one delete at a time.
export const MAX_INSTALLMENTS = 24

export type PlanDraft = {
  total: number
  discount: number
  count: number
  firstDue: string      // yyyy-mm-dd
  interval: PlanInterval
}

export type Installment = {
  amount: number
  period: string        // "April 2026"
  dueDate: string       // yyyy-mm-dd
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Parsed as calendar parts, not as a Date — the due date is a day on a wall
 *  calendar and must not shift because the phone is in another timezone. */
function parts(iso: string): { y: number; m: number; d: number } | null {
  if (!ISO.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { y, m, d }
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

const pad = (n: number) => String(n).padStart(2, '0')

/** Add whole months, clamping the day to the shortest month it lands in.
 *  A plan starting 31 January falls due on 28 February, not 3 March. */
export function addMonths(iso: string, n: number): string {
  const p = parts(iso)
  if (!p) return iso
  const zero = p.y * 12 + (p.m - 1) + n
  const y = Math.floor(zero / 12)
  const m = (zero % 12) + 1
  return `${y}-${pad(m)}-${pad(Math.min(p.d, daysInMonth(y, m)))}`
}

/** The month a due date sits in, which is what a parent calls the installment. */
export function periodLabel(iso: string): string {
  const p = parts(iso)
  return p ? `${MONTHS[p.m - 1]} ${p.y}` : ''
}

/** Mirrors what splitPlan can actually produce. The caller shows this sentence
 *  instead of letting the head press Save on a plan that makes no sense. */
export function validatePlan(d: PlanDraft, maxAmount: number): string | null {
  if (!Number.isFinite(d.total) || d.total <= 0) return 'Enter the total fee'
  if (!Number.isFinite(d.discount) || d.discount < 0) return 'Discount cannot be negative'
  if (d.discount >= d.total) return 'The discount cannot be the whole fee'
  if (!Number.isInteger(d.count) || d.count < 2) return 'A plan needs at least 2 installments'
  if (d.count > MAX_INSTALLMENTS) return `A plan cannot have more than ${MAX_INSTALLMENTS} installments`
  if (!parts(d.firstDue)) return 'Select the first due date'
  const payable = d.total - d.discount
  if (payable > maxAmount) return `Total cannot exceed ₹${maxAmount.toLocaleString('en-IN')}`
  // Below a rupee an installment the split rounds to zero and the plan is a
  // row of ₹0 demands.
  if (Math.round(payable * 100) < d.count * 100) return 'Each installment must be at least ₹1'
  return null
}

/** Split a plan into the rows that will be written.
 *
 *  Rounding rides on the FIRST installment, never the last. A final payment
 *  two rupees short of the total reads to a parent as a bug in the app; a first
 *  payment two rupees heavy reads as the plan. Worked in paise so the amounts
 *  add back up to the payable exactly, which floats would not guarantee.
 *
 *  Assumes validatePlan has passed; returns an empty list if it has not.
 */
export function splitPlan(d: PlanDraft): Installment[] {
  if (validatePlan(d, Number.MAX_SAFE_INTEGER)) return []
  const months = PLAN_INTERVALS.find(i => i.value === d.interval)?.months ?? 1
  const paise = Math.round((d.total - d.discount) * 100)
  const base = Math.floor(paise / d.count)
  const extra = paise - base * d.count
  return Array.from({ length: d.count }, (_, i) => {
    const dueDate = addMonths(d.firstDue, i * months)
    return {
      amount: (base + (i === 0 ? extra : 0)) / 100,
      period: periodLabel(dueDate),
      dueDate,
    }
  })
}

// ---------------------------------------------------------------------------

export type FeeLike = { amount: number; dueDate: string; status: string; period?: string }

/** Past its due date and still not paid.
 *
 *  Derived on read from the due date rather than stored, so it is right the
 *  morning it becomes true without anything having to run overnight. ISO dates
 *  compare correctly as strings, which is the whole reason the column is one.
 */
export function isOverdue(f: FeeLike, today: string): boolean {
  return f.status !== 'Paid' && !!f.dueDate && f.dueDate < today
}

export type FeeSummary = {
  total: number
  outstanding: number
  count: number
  paidCount: number
  overdueCount: number
  /** The soonest unpaid installment — what the family actually owes next. */
  next: FeeLike | null
}

/** One line's worth of truth about a student's fees.
 *
 *  Whole-student, not per plan: a child can have a plan and an ad-hoc late fee
 *  at the same time, and "3 of 6 paid" beside a balance that includes a seventh
 *  row nobody counted would be worse than no line at all.
 */
export function summariseFees(records: readonly FeeLike[], today: string): FeeSummary {
  let total = 0, outstanding = 0, paidCount = 0, overdueCount = 0
  let next: FeeLike | null = null
  for (const f of records) {
    const amt = Number(f.amount) || 0
    total += amt
    if (f.status === 'Paid') { paidCount++; continue }
    outstanding += amt
    if (isOverdue(f, today)) overdueCount++
    if (!next || (f.dueDate && f.dueDate < next.dueDate)) next = f
  }
  return { total, outstanding, count: records.length, paidCount, overdueCount, next }
}
