import { describe, expect, it } from 'vitest'
import { reminderTargets } from '../app/lib/reminders'
import type { Student } from '../app/store/types'

const kid = (over: Partial<Student>): Student => ({
  name: 'A', klass: '10', attendance: 100, attendanceMarked: 5, feeStatus: 'Paid',
  school: '', parent: '', id: '1', dbId: 'x', ...over,
})

describe('reminderTargets', () => {
  const roster = [
    kid({ id: '1', feeStatus: 'Due' }),
    kid({ id: '2', klass: '9', feeStatus: 'Due' }),
    kid({ id: '3', attendance: 80 }),
    kid({ id: '4', attendance: 0, attendanceMarked: 0 }),
    kid({ id: '5', dbId: undefined, feeStatus: 'Due' }),
  ]
  const ids = (xs: Student[]) => xs.map(s => s.id)

  it('skips students not saved yet', () => expect(ids(reminderTargets(roster))).toEqual(['1', '2', '3', '4']))
  it('fees_due keeps only unpaid', () => expect(ids(reminderTargets(roster, 'fees_due'))).toEqual(['1', '2']))
  it('absentees ignores a child never marked', () => expect(ids(reminderTargets(roster, 'absentees'))).toEqual(['3']))
  it('class narrows the filter instead of replacing it', () => expect(ids(reminderTargets(roster, 'fees_due', '9'))).toEqual(['2']))
  it('all means every class', () => expect(reminderTargets(roster, 'fees_due', 'all')).toHaveLength(2))
})
