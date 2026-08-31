// Parent reach — how much of the roster is actually looking.
//
// A centre's student count is a number the head already knows. What she has
// never been able to see is how many of those families ever open the app, and
// that is the only number that says whether the thing is working. Enrolment is
// what she pays for; reach is what she gets.
//
// The signal is students.last_seen_at, stamped by get_student_snapshot on the
// household's own app-open path (see 0024_parent_reach.sql). Nobody types it.
//
// Two buckets, not three. A family that last opened the app in June and one
// that has never opened it at all are the same conversation for the head, and
// a number nobody acts on is not worth the pixels.

// A week, because the centre's rhythm is a week: marks go up, attendance
// settles, the head looks on a Sunday. A parent who opened the app inside that
// window saw this week's picture.
export const ACTIVE_DAYS = 7

const DAY = 86_400_000

interface ReachSummary {
  /** Opened the app inside the window. */
  active: number
  /** Everyone else — the list worth chasing. */
  missed: number
  /** Active as a whole percentage of the roster. 0 when the roster is empty. */
  percent: number
}

/** Did this family open the app inside the window? */
export function opened(student: { lastSeenAt?: string }, now = Date.now()): boolean {
  // A missing or unreadable timestamp is not evidence anyone looked.
  const at = student.lastSeenAt ? Date.parse(student.lastSeenAt) : NaN
  return !Number.isNaN(at) && now - at <= ACTIVE_DAYS * DAY
}

export function reachSummary(students: readonly { lastSeenAt?: string }[], now = Date.now()): ReachSummary {
  let active = 0
  for (const s of students) if (opened(s, now)) active++
  const total = students.length
  return { active, missed: total - active, percent: total ? Math.round((active / total) * 100) : 0 }
}
