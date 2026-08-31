// Whether the centre is actually running yet.
//
// A head who signs in on day one sees a screen of zeros: no classes, no
// students, four quick actions that all lead to empty screens. Nothing says
// what to do first, and the one thing that makes the whole app worth having —
// a parent opening it and seeing their child's week — is three steps away with
// no sign that those steps exist.
//
// Three steps, because three is what the app genuinely needs before it does
// anything for anybody:
//
//   roster    nothing works without students
//   register  the first marked attendance is the first thing worth looking at
//   parents   a code nobody was sent is a login nobody uses
//
// Every one of them is read off data the app already holds. Nobody ticks a box
// and nobody types anything new — a checklist that cost data entry would be
// exactly the kind of feature this app does not ship.

export interface SetupProgress {
  /** Any students on the roster at all. */
  roster: boolean
  /** The register has been marked at least once, for anybody. */
  register: boolean
  /** At least one family has opened the app, so the codes are reaching them. */
  parents: boolean
  /** All three. The card that shows this progress disappears at this point. */
  done: boolean
}

/**
 * How far the centre has got.
 *
 * `parents` asks whether a family has *ever* opened the app, not whether one
 * did this week — that weekly question is parent reach, which is a running
 * measure for a centre already up and running. Here the question is only
 * whether the codes ever landed.
 */
export function setupProgress(
  students: readonly { attendanceMarked?: number; lastSeenAt?: string }[],
): SetupProgress {
  const roster = students.length > 0
  const register = students.some(s => (s.attendanceMarked ?? 0) > 0)
  const parents = students.some(s => !Number.isNaN(Date.parse(s.lastSeenAt ?? '')))
  return { roster, register, parents, done: roster && register && parents }
}
