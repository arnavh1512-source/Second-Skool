import { describe, it, expect } from 'vitest'
import { feeStatusAfter } from '../app/store/slices/fees'
import type { FeeRecord } from '../app/store/types'

const fee = (status: FeeRecord['status'], amount = 500): FeeRecord =>
  ({ dbId: crypto.randomUUID(), period: 'July 2026', amount, dueDate: '2026-07-05', status })

// Deleting a fee is the first thing in this app that can *reduce* what a
// family owes, and students.fee_status is a stored column that no amount of
// refreshing recomputes. Get this backwards and a head who removes a mistyped
// fee leaves the child still badged as owing money — or, worse, badges a
// student Paid while real fees are still outstanding.

describe('feeStatusAfter', () => {
  it('clears the badge when the last outstanding fee is gone', () => {
    // The exact case that prompted this: one fee, entered by mistake, removed.
    expect(feeStatusAfter([])).toBe('Paid')
  })

  it('keeps Due while anything is still outstanding', () => {
    expect(feeStatusAfter([fee('Due')])).toBe('Due')
    expect(feeStatusAfter([fee('Paid'), fee('Due')])).toBe('Due')
  })

  it('treats Overdue as outstanding, not settled', () => {
    // 'Overdue' is a third value the fees check constraint allows. Testing
    // only against 'Due' would quietly mark a defaulting family as Paid.
    expect(feeStatusAfter([fee('Overdue')])).toBe('Due')
    expect(feeStatusAfter([fee('Paid'), fee('Overdue')])).toBe('Due')
  })

  it('reads Paid when every remaining record is settled', () => {
    expect(feeStatusAfter([fee('Paid'), fee('Paid')])).toBe('Paid')
  })

  it('ignores the amounts entirely', () => {
    // A zero-rupee due row is still a row the parent can see, and a large
    // paid one does not make an outstanding fee go away.
    expect(feeStatusAfter([fee('Due', 0)])).toBe('Due')
    expect(feeStatusAfter([fee('Paid', 100000)])).toBe('Paid')
  })
})
