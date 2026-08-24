import type { FeeRecord, FeeStatus } from '../store/types'

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
