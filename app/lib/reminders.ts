import type { Student } from '../store/types'

/** Who a reminder reaches. Shared with the composer so the confirm step
    names the same count the send will reach. */
export function reminderTargets(students: readonly Student[], filter?: string, targetClass?: string): Student[] {
  let targets = students.filter(s => s.dbId)
  // Not `attendance === 0`. A student added this morning has no attendance
  // rows yet, so the mapper leaves the percentage at its 0 default — and an
  // "Absence Reminder" to a parent on their child's first day is exactly the
  // kind of wrong that loses a centre. Only students who have actually been
  // marked at least once, and who missed at least one of those days, count.
  if (filter === 'absentees') targets = targets.filter(s => (s.attendanceMarked ?? 0) > 0 && s.attendance < 100)
  else if (filter === 'fees_due') targets = targets.filter(s => s.feeStatus !== 'Paid')
  // Narrows whatever the filter left, rather than being the alternative to
  // it. A head chasing fees inside one class asked for both conditions, and
  // the class used to be dropped the moment a filter was present.
  if (targetClass && targetClass !== 'all') targets = targets.filter(s => s.klass === targetClass)
  return targets
}
