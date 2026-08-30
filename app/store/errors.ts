// Turns whatever Postgres, PostgREST or the network hands back into a sentence
// a teacher can act on.
//
// The app used to do `error.message || 'Could not save'`, which reads as a
// fallback but is the opposite: PostgREST always populates `message`, so the
// friendly half was dead code and the user got the raw database text. After
// 0016 added CHECK constraints that means a teacher who types too long a name
// is shown:
//
//   new row for relation "students" violates check constraint "students_text_lengths"
//
// She cannot act on that, and it looks like the app broke rather than like she
// typed something the app won't accept. Constraint names are the most precise
// signal we have about what was actually wrong, so they map first; error codes
// catch the rest; the raw text is never surfaced (it still goes to logError).

type PgLike = { code?: string; message?: string; details?: string } | null | undefined

// Keyed on the constraint names created in 0016_data_integrity.sql. If a
// constraint is renamed there and not here, the code-level fallback below still
// produces something readable — this table only makes it specific.
const BY_CONSTRAINT: Record<string, string> = {
  students_text_lengths: 'One of the details is too long. Keep names and addresses shorter.',
  assignments_title_length: 'The homework title must be between 1 and 120 characters.',
  notes_title_length: 'The note title must be between 1 and 120 characters.',
  notes_link_url_https: 'The link must be a full https:// web address.',
  tests_max_marks_range: 'Total marks must be between 1 and 1000.',
  results_marks_non_negative: 'Marks cannot be negative.',
  fees_amount_range: 'Enter a fee amount greater than zero.',
  fees_period_length: 'The fee period is too long. Try something like "April 2026".',
}

// P0001 is the SQLSTATE plpgsql produces for `raise exception`. Every one of
// those in supabase/migrations was hand-written for the person reading it —
// "Invalid centre code — check with your teacher", "Too many attempts, please
// try again in a minute". Those are better than anything this module could
// substitute, so they pass through untouched. A handful are internal plumbing
// from the push RPCs and were never meant for a user; they fall through to the
// generic text instead.
const INTERNAL_RAISES = new Set(['bad endpoint', 'bad keys', 'bad kind', 'bad ref'])

const BY_CODE: Record<string, string> = {
  '23505': 'This is already saved — it looks like a duplicate.',
  '23503': 'That record is linked to something else, so it cannot be saved yet.',
  '23514': "Some of what you entered isn't allowed. Please check the values and try again.",
  '23502': 'Something required was left blank.',
  '42501': "You don't have permission to do that. Ask the centre head.",
  '22P02': "One of the values isn't in the right format.",
  PGRST301: 'Your session has expired. Please sign in again.',
}

// Supabase surfaces a dropped connection as a plain TypeError from fetch, with
// no code at all — the single most common failure at a centre on mobile data.
// Exported because the attendance queue needs the same test for a different
// reason: this decides what wording a teacher sees, and there it decides
// whether a register is held for retry or thrown away.
export const looksOffline = (e: PgLike) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const m = e?.message ?? ''
  return /failed to fetch|networkerror|load failed|fetch failed/i.test(m)
}

/**
 * @param action What the user was trying to do, phrased as a noun: "save
 *   attendance", "add the fee". It is read inside a sentence, so no capital.
 */
export const friendlyError = (error: unknown, action: string): string => {
  const e = error as PgLike
  if (looksOffline(e)) return `No internet — couldn't ${action}. It has not been saved. Try again once you're back online.`

  const msg = e?.message ?? ''

  // Trust the database when a human wrote the sentence.
  if (e?.code === 'P0001' && msg.trim() && !INTERNAL_RAISES.has(msg.trim().toLowerCase())) return msg.trim()

  for (const [name, text] of Object.entries(BY_CONSTRAINT)) {
    if (msg.includes(name)) return text
  }
  const byCode = e?.code ? BY_CODE[e.code] : undefined
  if (byCode) return byCode

  return `Couldn't ${action}. Please try again.`
}
