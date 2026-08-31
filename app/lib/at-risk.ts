// The student who has quietly stopped coming.
//
// This is the most expensive thing a tuition centre fails to notice. A child
// stops turning up in the first week of the month; the head finds out when the
// fee does not arrive at the end of it, by which point the family has already
// joined somewhere else and the conversation is a refund rather than a
// "is everything alright?". One student is a month of fees; three is the
// difference between a centre that grows and one that leaks.
//
// Nothing about it is hard to see in the data. The register is marked every
// day, and a child who was absent the last three times their class ran has
// stopped coming — that is not a pattern anybody needs a report to spot. It is
// only invisible because no screen has ever put those three rows next to each
// other. Attendance in this app is a lifetime percentage, and a lifetime
// percentage is exactly the statistic that hides a recent collapse: a student
// with two years of perfect attendance still reads as 96% three weeks after
// they left.
//
// So this reads recency instead of totals, off rows the app already fetches,
// from a register the teacher already marks. No new screen to fill in, nothing
// for anybody to remember to do.

/** A row of the register, as the database stores it. */
interface AttendanceRow {
  student_id?: unknown
  date?: unknown
  status?: unknown
}

/**
 * Absences in a row that mean "stopped coming" rather than "had a cold".
 *
 * Two is a bad week — a fever runs that long and the child is back on
 * Thursday. Three consecutive sessions is the point where chasing it is worth
 * a message, and it is still early enough that the answer can be "yes, they're
 * coming back". Waiting for five would make the signal certain and the
 * conversation pointless.
 */
const MISSED_SESSIONS = 3

export interface AtRisk {
  /** The student's database id — the key the roster is indexed by. */
  studentId: string
  /** Consecutive sessions missed, counting back from the last one marked. */
  missed: number
  /** The last day they were marked present, or null if that never happened. */
  lastPresent: string | null
}

/**
 * Who has stopped coming, keyed by student id — the way every screen holding a
 * roster looks a student up.
 *
 * Only the run of absences ending at the most recent marked session counts. A
 * student who missed a fortnight in June and has been in every day since is
 * not a student anybody needs to ring, and surfacing them would teach the head
 * to ignore the list — which is the way a signal like this actually dies.
 *
 * Anything that is not an absence ends the run, `Leave` included: a family who
 * told the centre their child would be away is the one case here that is
 * already handled. The whole point is the absence nobody explained.
 *
 * Rows may arrive in any order and may repeat a day (the register can be
 * marked twice), so days are collapsed and sorted here rather than trusted.
 */
export function atRisk(rows: readonly AttendanceRow[]): Record<string, AtRisk> {
  // student -> day -> status. A day marked twice keeps the last write, which is
  // the correction rather than the mistake.
  const byStudent = new Map<string, Map<string, string>>()
  for (const r of rows) {
    const id = r?.student_id
    const day = r?.date
    const status = r?.status
    if (typeof id !== 'string' || !id) continue
    if (typeof day !== 'string' || !day) continue
    if (typeof status !== 'string') continue
    let days = byStudent.get(id)
    if (!days) { days = new Map(); byStudent.set(id, days) }
    days.set(day, status)
  }

  const out: Record<string, AtRisk> = {}
  for (const [studentId, days] of byStudent) {
    // Dates are stored as YYYY-MM-DD, so string order is date order.
    const sorted = [...days.keys()].sort().reverse()
    let missed = 0
    for (const day of sorted) {
      if (days.get(day) !== 'Absent') break
      missed++
    }
    if (missed < MISSED_SESSIONS) continue
    out[studentId] = {
      studentId,
      missed,
      lastPresent: sorted.find(d => days.get(d) === 'Present') ?? null,
    }
  }
  return out
}
