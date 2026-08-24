// Which tables a centre delete has to clear, and in what order.
//
// This list used to live inside the dev route, where nothing could see it drift.
// It did drift: `batches` arrived in migration 0006 carrying a centre_id FK and
// was never added here, so the final `delete from centres` hit a foreign-key
// violation and the operator console reported "the centre's data was cleared but
// the centre could not be removed" — a wiped centre that would not go away.
//
// It is out here now so centre-delete-coverage.test.ts can check it against the
// migrations and fail the build the next time a centre-scoped table is added
// without being listed.

// Leaves first: these carry centre_id and are also referenced by nothing, or
// reference rows in SPINE_TABLES. None of those FKs cascade, so Postgres
// refuses the parent unless these come out first.
export const LEAF_TABLES = [
  'attendance', 'attendance_monthly', 'results', 'assignments', 'fees',
  'notifications', 'reminders', 'meetings', 'timetable', 'notes',
  'push_subscriptions', 'batches',
] as const
// Note: push_subscriptions.centre_id is a bare uuid with no FK to centres, so it
// is centre-scoped in fact but invisible to the coverage test's constraint scan.
// It still has to be cleared — a live subscription pointing at a deleted centre
// is a device that keeps a seat in the push table forever.

// Then the spine: tests point at subjects, attendance pointed at students,
// timetable pointed at teachers. Safe to remove once the leaves are gone.
export const SPINE_TABLES = ['tests', 'students', 'teachers', 'subjects', 'branches'] as const

// Tables that carry centre_id but are deliberately not deleted:
//   profiles — members are detached (centre_id set to null), never deleted;
//              erasing a centre must not erase the people who were in it.
//   centres  — the parent row itself, removed last by the caller.
export const CENTRE_DELETE_EXEMPT = ['profiles', 'centres'] as const

// What counts as a centre being used. This drives the operator console's
// "no activity in N days (never used)" flag, which is the prompt to delete a
// centre - so a table missing here does not merely under-report, it invites
// deleting a centre that is quietly in use. fees, meetings and timetable were
// all absent: a teacher who collected fees and built a timetable but had not
// yet marked attendance read as never used.
export const ACTIVITY_TABLES = [
  'attendance', 'results', 'assignments', 'tests', 'notes',
  'reminders', 'fees', 'meetings', 'timetable',
] as const

// Centre-scoped tables that deliberately do not count as activity:
//   attendance_monthly - a rollup of attendance, not a separate thing anyone did
//   notifications      - written by the system, not by the teacher
//   push_subscriptions - a device registering, not work done in the app
//   batches, subjects, branches - reference lists, part of setting up
//   students, teachers - the roster; a centre with a roster and nothing else
//                        genuinely is set up but never used, which is exactly
//                        the signal the console is trying to give.
export const NOT_ACTIVITY = [
  'attendance_monthly', 'notifications', 'push_subscriptions',
  'batches', 'subjects', 'branches', 'students', 'teachers',
] as const
