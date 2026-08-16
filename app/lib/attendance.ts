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
//     where `supabase/attendance-totals.sql` has not been applied yet.

export type AttendanceTotal = { student_id: string; present: number; total: number }
export type AttendanceCount = { p: number; t: number }

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
