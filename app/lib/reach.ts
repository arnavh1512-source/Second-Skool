// Parent reach — how much of the roster is actually looking.
//
// A centre's student count is a number the head already knows. What she has
// never been able to see is how many of those families ever open the app, and
// that is the only number that says whether the thing is working. Enrolment is
// what she pays for; reach is what she gets.
//
// The signal is students.last_seen_at, stamped by get_student_snapshot on the
// household's own app-open path (see 0024_parent_reach.sql). Nobody types it.

// A week, because the centre's rhythm is a week: marks go up, attendance
// settles, the head looks on a Sunday. A parent who opened the app inside that
// window saw this week's picture.
export const ACTIVE_DAYS = 7

const DAY = 86_400_000

export interface ReachSummary {
  active: number
  quiet: number
  /** Never opened the app at all — the list worth chasing. */
  never: number
  total: number
  /** Active as a whole percentage of the roster. 0 when the roster is empty. */
  percent: number
}

export function bucketFor(lastSeenAt: string | undefined, now: number): 'active' | 'quiet' | 'never' {
  if (!lastSeenAt) return 'never'
  const at = Date.parse(lastSeenAt)
  // An unparseable timestamp is not evidence anyone looked.
  if (Number.isNaN(at)) return 'never'
  return now - at <= ACTIVE_DAYS * DAY ? 'active' : 'quiet'
}

export function reachSummary(students: readonly { lastSeenAt?: string }[], now = Date.now()): ReachSummary {
  const total = students.length
  let active = 0
  let quiet = 0
  for (const s of students) {
    const b = bucketFor(s.lastSeenAt, now)
    if (b === 'active') active++
    else if (b === 'quiet') quiet++
  }
  return { active, quiet, never: total - active - quiet, total, percent: total ? Math.round((active / total) * 100) : 0 }
}
