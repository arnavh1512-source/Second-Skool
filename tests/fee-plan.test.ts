import { describe, it, expect } from 'vitest'
import {
  addMonths, periodLabel, validatePlan, splitPlan, isOverdue, summariseFees,
  MAX_INSTALLMENTS, type PlanDraft,
} from '../app/lib/fee-plan'

const plan = (over: Partial<PlanDraft> = {}): PlanDraft => ({
  total: 12000, discount: 0, count: 6, firstDue: '2026-04-05', interval: 'monthly', ...over,
})

describe('addMonths', () => {
  it('advances the month and keeps the day', () => {
    expect(addMonths('2026-04-05', 1)).toBe('2026-05-05')
    expect(addMonths('2026-04-05', 3)).toBe('2026-07-05')
  })

  it('rolls into the next year', () => {
    expect(addMonths('2026-11-10', 3)).toBe('2027-02-10')
  })

  // A plan starting on the 31st must not skip a month by overflowing into the
  // next one, which is what Date.setMonth does on its own.
  it('clamps to the last day of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('leaves a malformed date alone', () => {
    expect(addMonths('not-a-date', 1)).toBe('not-a-date')
  })
})

describe('periodLabel', () => {
  it('names the month the due date sits in', () => {
    expect(periodLabel('2026-04-05')).toBe('April 2026')
    expect(periodLabel('2026-12-31')).toBe('December 2026')
  })

  it('is empty for a malformed date', () => {
    expect(periodLabel('')).toBe('')
  })
})

describe('validatePlan', () => {
  const MAX = 10_000_000

  it('passes a sensible plan', () => {
    expect(validatePlan(plan(), MAX)).toBeNull()
  })

  it('rejects a missing or negative total', () => {
    expect(validatePlan(plan({ total: 0 }), MAX)).toBe('Enter the total fee')
    expect(validatePlan(plan({ total: NaN }), MAX)).toBe('Enter the total fee')
  })

  it('rejects a discount that swallows the fee', () => {
    expect(validatePlan(plan({ discount: 12000 }), MAX)).toBe('The discount cannot be the whole fee')
    expect(validatePlan(plan({ discount: -1 }), MAX)).toBe('Discount cannot be negative')
  })

  it('needs at least two installments — one is just a fee', () => {
    expect(validatePlan(plan({ count: 1 }), MAX)).toBe('A plan needs at least 2 installments')
  })

  it('caps the installment count', () => {
    expect(validatePlan(plan({ count: MAX_INSTALLMENTS }), MAX)).toBeNull()
    expect(validatePlan(plan({ count: MAX_INSTALLMENTS + 1 }), MAX))
      .toBe(`A plan cannot have more than ${MAX_INSTALLMENTS} installments`)
  })

  it('needs a real first due date', () => {
    expect(validatePlan(plan({ firstDue: '' }), MAX)).toBe('Select the first due date')
    expect(validatePlan(plan({ firstDue: '2026-13-01' }), MAX)).toBe('Select the first due date')
  })

  // numeric(10,2) is the column; anything above it is a Postgres error the
  // head would never see an explanation for.
  it('respects the column ceiling, after the discount', () => {
    expect(validatePlan(plan({ total: MAX + 1 }), MAX)).toBe(`Total cannot exceed ₹${MAX.toLocaleString('en-IN')}`)
    expect(validatePlan(plan({ total: MAX + 1, discount: 1 }), MAX)).toBeNull()
  })

  it('refuses a split that rounds to nothing', () => {
    expect(validatePlan(plan({ total: 5, count: 6 }), MAX)).toBe('Each installment must be at least ₹1')
  })
})

describe('splitPlan', () => {
  it('splits evenly when it divides', () => {
    const out = splitPlan(plan())
    expect(out).toHaveLength(6)
    expect(out.map(i => i.amount)).toEqual([2000, 2000, 2000, 2000, 2000, 2000])
  })

  it('puts the rounding on the first installment, never the last', () => {
    const out = splitPlan(plan({ total: 12000, discount: 1000, count: 6 }))
    expect(out.map(i => i.amount)).toEqual([1833.35, 1833.33, 1833.33, 1833.33, 1833.33, 1833.33])
    expect(out[out.length - 1].amount).toBeLessThanOrEqual(out[0].amount)
  })

  it('always adds back up to the payable amount exactly', () => {
    for (const [total, discount, count] of [[12000, 1000, 6], [10000, 0, 7], [999.99, 0.5, 3], [5000, 0, 24]]) {
      const paise = splitPlan(plan({ total, discount, count }))
        .reduce((n, i) => n + Math.round(i.amount * 100), 0)
      expect(paise).toBe(Math.round((total - discount) * 100))
    }
  })

  it('walks the due dates by the interval and names each period', () => {
    const monthly = splitPlan(plan({ count: 3 }))
    expect(monthly.map(i => i.dueDate)).toEqual(['2026-04-05', '2026-05-05', '2026-06-05'])
    expect(monthly.map(i => i.period)).toEqual(['April 2026', 'May 2026', 'June 2026'])

    const quarterly = splitPlan(plan({ count: 3, interval: 'quarterly' }))
    expect(quarterly.map(i => i.dueDate)).toEqual(['2026-04-05', '2026-07-05', '2026-10-05'])
  })

  it('produces nothing for a plan that does not validate', () => {
    expect(splitPlan(plan({ count: 1 }))).toEqual([])
  })
})

describe('isOverdue', () => {
  const due = (dueDate: string, status = 'Due') => ({ amount: 100, dueDate, status })

  it('is true only once the due date has passed', () => {
    expect(isOverdue(due('2026-08-28'), '2026-08-29')).toBe(true)
    expect(isOverdue(due('2026-08-29'), '2026-08-29')).toBe(false)
    expect(isOverdue(due('2026-08-30'), '2026-08-29')).toBe(false)
  })

  it('is never true for a paid fee, however old', () => {
    expect(isOverdue(due('2020-01-01', 'Paid'), '2026-08-29')).toBe(false)
  })

  it('is false when there is no due date to be past', () => {
    expect(isOverdue(due(''), '2026-08-29')).toBe(false)
  })
})

describe('summariseFees', () => {
  const rows = [
    { amount: 2000, dueDate: '2026-04-05', status: 'Paid', period: 'April 2026' },
    { amount: 2000, dueDate: '2026-05-05', status: 'Paid', period: 'May 2026' },
    { amount: 2000, dueDate: '2026-06-05', status: 'Due', period: 'June 2026' },
    { amount: 2000, dueDate: '2026-09-05', status: 'Due', period: 'September 2026' },
  ]

  it('counts the money and the installments', () => {
    const s = summariseFees(rows, '2026-08-29')
    expect(s.total).toBe(8000)
    expect(s.outstanding).toBe(4000)
    expect(s.count).toBe(4)
    expect(s.paidCount).toBe(2)
  })

  it('counts only the unpaid rows whose date has passed', () => {
    expect(summariseFees(rows, '2026-08-29').overdueCount).toBe(1)
    expect(summariseFees(rows, '2026-01-01').overdueCount).toBe(0)
  })

  // The rows arrive newest-first from both the head query and the student
  // snapshot, so "the first unpaid one" is the furthest-away installment —
  // which is precisely the wrong one to put in front of a parent.
  it('picks the soonest unpaid installment, not the first in the list', () => {
    const newestFirst = [...rows].reverse()
    expect(summariseFees(newestFirst, '2026-08-29').next?.period).toBe('June 2026')
  })

  it('has no next payment once everything is paid', () => {
    const s = summariseFees(rows.map(r => ({ ...r, status: 'Paid' })), '2026-08-29')
    expect(s.next).toBeNull()
    expect(s.outstanding).toBe(0)
  })

  it('handles a student with no fees at all', () => {
    expect(summariseFees([], '2026-08-29')).toEqual({
      total: 0, outstanding: 0, count: 0, paidCount: 0, overdueCount: 0, next: null,
    })
  })
})
