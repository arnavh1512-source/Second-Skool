// One stable handle for a student, and the lookups that go with it.
//
// The roster is re-fetched `created_at DESC` on every focus, every visibility
// change and every service-worker refresh, so a student added or approved
// anywhere — another device, another tab, the head's own Add Student screen —
// shifts every array position by one. Anything that remembers *which* student
// the user is working on must remember this key, never an index:
//
//   * the open Edit Student screen (a wrong index edits and deletes the wrong
//     student, cascading their attendance, results, fees and notes)
//   * today's attendance marks (a wrong index marks the wrong child absent and
//     tells their parent so)
//   * the marks being typed into a test (a wrong index publishes one student's
//     result under another's name, to every parent in the class)
//
// Positions are for rendering. Identity is for remembering.

/** A roster row, or any lighter view of one that can still be addressed. */
export type Identifiable = { id?: string; dbId?: string }

/**
 * `dbId` is the database uuid and is what every write is keyed on. A student
 * added moments ago has no uuid until the insert returns, so their student code
 * stands in until it does — `addStudent` generates that code with a collision
 * check, so it is unique across the roster too.
 */
export const studentKey = (s: Identifiable | undefined | null): string =>
  s?.dbId ?? s?.id ?? ''

/** Resolve a remembered key back to the live row, or undefined if it has gone. */
export const findStudent = <T extends Identifiable>(
  list: readonly T[],
  key: string,
): T | undefined => (key ? list.find(s => studentKey(s) === key) : undefined)

/**
 * Position of a remembered key, or -1. Only for the few callers that genuinely
 * need the slot — an avatar colour, a splice — and never for identity.
 */
export const indexOfStudent = (list: readonly Identifiable[], key: string): number =>
  key ? list.findIndex(s => studentKey(s) === key) : -1

/**
 * Same problem, same shape, for the teacher list a student browses: it is
 * fetched `created_at DESC` and re-fetched on every background refresh, so a
 * remembered position points at a different person once anyone is added. A
 * teacher row carries no student code, so the name is the fallback.
 */
export const teacherKey = (t: { dbId?: string; name?: string } | undefined | null): string =>
  t?.dbId ?? t?.name ?? ''
