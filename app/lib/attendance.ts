import { studentKey, type Identifiable } from './student-key'
import { parseDay } from '../store/format'

// Attendance percentage maths, kept pure and out of the data provider so it can
// be tested without a database.
//
// There are two ways the app can arrive at a student's percentage:
//
//  1. `student_attendance_totals()` — the database aggregates and returns one
//     row per student, spanning archived monthly rollups *and* un-archived
//     daily rows. Uncapped and always complete. This is the path we want.
//
//  2. Counting the daily attendance rows the browser happens to hold. That set
//     is capped, so past the cap the denominator is short and the percentage is
//     silently too high or too low. Kept only as a fallback for a database
//     where `supabase/migrations/0013_attendance_totals.sql` has not been applied yet.

export type AttendanceTotal = { student_id: string; present: number; total: number }
type AttendanceCount = { p: number; t: number }

/** Index server-computed totals by student id. */
export function totalsByStudent(rows: readonly AttendanceTotal[]): Record<string, AttendanceCount> {
  const out: Record<string, AttendanceCount> = {}
  for (const r of rows) {
    if (!r?.student_id) continue
    out[r.student_id] = { p: Number(r.present) || 0, t: Number(r.total) || 0 }
  }
  return out
}

/** Fallback: tally raw daily rows. Only as complete as the rows handed in. */
export function countDailyRows(rows: readonly { student_id?: unknown; status?: unknown }[]): Record<string, AttendanceCount> {
  const out: Record<string, AttendanceCount> = {}
  for (const a of rows) {
    const k = a?.student_id
    if (typeof k !== 'string' || !k) continue
    if (!out[k]) out[k] = { p: 0, t: 0 }
    out[k].t++
    if (a.status === 'Present') out[k].p++
  }
  return out
}

/**
 * Whole-percent attendance, or null when there is nothing to divide by.
 * Null means "no marks recorded", which the UI must not render as 0%.
 */
export function attendancePct(count: AttendanceCount | undefined): number | null {
  if (!count || count.t <= 0) return null
  return Math.round((count.p / count.t) * 100)
}

/**
 * One day's marks, indexed by student.
 *
 * The Mark Attendance screen opened from a blank slate every time, which reads
 * as "everybody present" — so a teacher who marked four children absent, left
 * the screen and came back saw a clean register and no sign her work had
 * happened. Nothing was lost, but she had no way to know that, and the obvious
 * response is to mark them again.
 *
 * The rows are already in the browser (the provider fetches them to compute
 * percentages and then drops them), so this costs one pass over an array and
 * nothing on the network.
 */
export function marksForDay(
  rows: readonly { student_id?: unknown; date?: unknown; status?: unknown }[],
  day: string,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of rows) {
    if (r?.date !== day) continue
    const k = r?.student_id
    if (typeof k !== 'string' || !k || typeof r.status !== 'string') continue
    out[k] = r.status
  }
  return out
}

/**
 * What the roster should look like when the screen opens.
 *
 * Three sources, in order of how recently the teacher touched them: everyone
 * starts present, the register overwrites that with what the centre has
 * recorded, and marks still queued on this phone overwrite that in turn —
 * those are the newest thing she did, they simply have not been sent yet.
 *
 * Keyed by `studentKey`, because this is handed straight to the screen's `att`
 * map and a mark that moves to another child is the worst bug this app has.
 *
 * `Leave` and anything else the register may hold is treated as present: the
 * screen is a two-state toggle and cannot represent a third answer, so the
 * safe reading is the one that does not tell a parent their child was absent.
 */
export function seedMarks(
  roster: readonly Identifiable[],
  recorded: Record<string, string>,
  queued: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of roster) {
    const key = studentKey(s)
    if (!key) continue
    // The two maps are keyed by database uuid, not by studentKey: they come off
    // rows the server wrote, and a student with no uuid yet has no rows there.
    const status = s.dbId ? queued[s.dbId] ?? recorded[s.dbId] : undefined
    out[key] = status === 'Absent' ? 'absent' : 'present'
  }
  return out
}

/**
 * Which class the Mark Attendance screen should show.
 *
 * The stored choice starts empty and nothing sets it until a class chip is
 * tapped, so the screen opened with chips rendered, 0 present, 0 absent and no
 * students — on a centre where every student has a class. The store is not
 * persisted, so that was every page load, on the screen a teacher opens daily.
 * ResultsScreen always fell back to the first class; this had no fallback.
 *
 * Also covers the stale case: delete the last student of a class, or rename it,
 * and the stored choice names a class that no longer exists.
 *
 * Returns '' only when there are genuinely no classes, which the caller shows
 * as the "no students yet" empty state.
 */
export function pickAttendanceClass(classes: readonly string[], stored: string): string {
  return classes.includes(stored) ? stored : (classes[0] ?? '')
}

/**
 * The oldest day a teacher may still correct.
 *
 * `archive_old_attendance()` folds daily rows older than 90 days into monthly
 * totals and deletes them, so a day past that boundary has no rows to correct —
 * opening it would show an empty register, and saving that empty register would
 * write a fresh set of Presents for a day the centre had already counted.
 *
 * 89 rather than 90, because the archive runs on a day of its own choosing and
 * a register saved at the exact boundary can be swallowed before anybody reads
 * it back. One day of margin costs nothing and removes the whole race.
 */
export function earliestMarkableDay(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  d.setDate(d.getDate() - 89)
  return d
}

/**
 * How an absence message should name the day it is about.
 *
 * The push used to be hardcoded to "today", which was true for as long as the
 * register could only be marked for today. It stopped being true the moment a
 * teacher could fill in a day she had missed: a parent reading "marked absent
 * today" on Friday about Monday is being told their child missed Friday.
 *
 * A day that is not today is named outright rather than described as "on
 * Monday", because a parent opening the phone a week later has no way to know
 * which Monday.
 */
export function absenceDayLabel(day: string, today: string): string {
  if (day === today) return 'today'
  const d = parseDay(day)
  if (!d) return 'today'
  return `on ${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
}
