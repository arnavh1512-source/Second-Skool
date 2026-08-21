// Input limits and boundary validation.
//
// The app has no schema-validation library (see AGENTS.md — hand-validation is
// the convention here), so these are the one place the caps live. Every screen
// that writes user text imports from here rather than inventing its own number,
// and supabase/migrations/0016_data_integrity.sql enforces the same ceilings in
// the database so a direct API call cannot bypass the UI.

export const LIMITS = {
  name: 80,        // longest realistic Indian full name + honorific, with room
  klass: 40,
  school: 120,
  parent: 20,      // +91 98765 43210 is 17
  address: 200,
  period: 40,      // "Aug 2026", "Q2 2026-27"
  title: 120,
  maxMarks: 1000,  // board papers top out well below this
  feeAmount: 10_000_000, // ₹1 crore — above any real tuition instalment, below
                         // the numeric(10,2) overflow that used to reject it
                         // with no message the head could act on
} as const

/**
 * Cut to length, keeping whitespace. For fields edited live, keystroke by
 * keystroke — trimming here would swallow the space the moment it is typed,
 * so "John" could never become "John Smith".
 */
export const capLength = (v: string, max: number): string => v.slice(0, max)

/** Trim and cut to length. For values on their way to the database. */
export const clampText = (v: string, max: number): string => v.trim().slice(0, max)

/**
 * True only for a whole number inside [min, max].
 *
 * `Number('')` is 0 and `Number('abc')` is NaN, and both used to sail into an
 * `int` column — an empty marks box became a zero on a student's report card.
 */
export const isWholeNumber = (raw: string, min: number, max: number): boolean => {
  const trimmed = raw.trim()
  if (!/^\d+$/.test(trimmed)) return false
  const n = Number(trimmed)
  return Number.isInteger(n) && n >= min && n <= max
}

/**
 * Normalise a teacher-supplied link, or null if it is not safe to store.
 *
 * Only https survives. `javascript:` is the reason this exists — React refuses
 * to navigate one today, but the row is still served to every student in the
 * class and to whatever reads the API next, and a stored payload waiting for a
 * renderer that does follow it is not a bug worth keeping. http is refused too:
 * these links are opened by children on shared networks.
 */
export const safeLinkUrl = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}
