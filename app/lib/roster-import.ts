// Reading a roster out of whatever the head already has.
//
// Adding students one at a time is a nine-field form. A centre with sixty
// students is an evening of typing before the app does anything at all, and
// that evening is where adoption actually dies — not in any feature we have
// or have not built.
//
// But the head is never starting from nothing. The list exists already: a
// column in Excel, a message a colleague sent on WhatsApp, a register typed
// into Notes. So the import takes a paste and works out what it is looking at,
// rather than asking anyone to reformat anything first.
//
// Nothing here touches React or the network, so the guessing can be tested
// against the shapes real lists actually arrive in.

import { LIMITS, clampText } from '../store/validate'

/** One paste. Past this the preview stops being reviewable and the insert stops
 *  being one round trip — she splits the list, which is the honest answer. */
export const MAX_IMPORT = 200

export interface ParsedStudent {
  name: string
  klass: string
  /** E.164, or '' when the line carried no usable number. */
  parent: string
  school: string
}

export type SkipReason =
  | 'no name on this line'
  | 'the same student twice in this list'
  | 'already on your roster'

export interface SkippedLine {
  /** 1-based, counting the raw pasted lines, so it matches what she is looking at. */
  line: number
  text: string
  reason: SkipReason
}

export interface ParsedRoster {
  students: ParsedStudent[]
  skipped: SkippedLine[]
  /** Lines past MAX_IMPORT, which were not looked at. */
  overflow: number
}

/**
 * An Indian mobile number in E.164, or null.
 *
 * Accepts the forms a phone book actually holds — `98765 43210`,
 * `+91-98765-43210`, `919876543210` — and rejects landlines and truncated
 * numbers, because a wrong number here sends a child's attendance to a
 * stranger.
 *
 * A leading trunk `0` is deliberately not stripped. `0` + ten digits is also
 * exactly the shape of a landline (`079 2630 1234`), and after the zero goes
 * an Ahmedabad number reads as a mobile starting 79 — the two cannot be told
 * apart by shape at all. Contacts are stored as ten digits or with +91 anyway;
 * the trunk zero is something you dial, not something you save. A row we refuse
 * imports with no number and says so, which she can fix in one edit.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null
}

/**
 * A standard in the app's own wording, or null.
 *
 * The same class is written five ways across one staff room — `10`, `10th`,
 * `Class 10`, `Std 10`, `X` — and all of them have to land on the one string
 * the batches, rankings and report cards group by.
 */
export function normalizeClass(raw: string): string | null {
  const t = raw.trim().toLowerCase().replace(/^(class|std|standard|grade)\.?\s*/, '')
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 }
  // Guarded by the pattern rather than by a lookup miss: an unguarded index
  // into an object literal finds Object.prototype, so "constructor" would
  // resolve to a function on its way into a numeric comparison.
  const n = /^[ivx]+$/.test(t) ? roman[t] : Number(t.match(/^(\d{1,2})\s*(?:st|nd|rd|th)?$/)?.[1])
  return n >= 1 && n <= 12 ? `Class ${n}` : null
}

// Tabs (Excel), the usual separators, a spaced hyphen ("Rahul - 98765 43210")
// and runs of two or more spaces (a column pasted out of a PDF). A single space
// is never a separator: it is the space in "Rahul Sharma".
const CELL = /\t|\s*[,;|]\s*|\s+[-–—]\s+|\s{2,}/

// "1." / "1)" / "1 -" in front of a name, which is how a numbered list arrives.
const LIST_PREFIX = /^\s*\d{1,3}\s*[.)]\s*/

// A spreadsheet's first row names its columns. Content detection would read it
// as a student called "Name" — and the head, having pasted sixty rows, is not
// going to spot the sixty-first.
const HEADER_WORD = /^(sr|s\.?no|no|#|name|student|student name|full name|class|std|standard|grade|school|parent|parent name|father|mother|guardian|contact|phone|mobile|number|whatsapp)$/i

const isHeader = (cells: readonly string[]): boolean =>
  cells.length > 1 && cells.every(c => HEADER_WORD.test(c.trim()))

/** Fold for duplicate detection: case and spacing vary, the person does not. */
const fold = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

export interface ExistingStudent { name: string; parent?: string }

/**
 * What a pasted list means.
 *
 * Cells are read by what they contain rather than by which column they sit in,
 * because the order is different in every list and asking her to rearrange it
 * first would cost more than the typing did. A number that looks like a mobile
 * is the parent's contact wherever it appears; the rest is the name, then the
 * school.
 *
 * `defaultClass` fills the rows that named no class. Skipping those instead
 * would quietly drop the students whose row was thinnest — usually the ones
 * added to the list in a hurry.
 */
export function parseRoster(
  raw: string,
  existing: readonly ExistingStudent[],
  defaultClass: string,
): ParsedRoster {
  const lines = raw.split(/\r?\n/)
  const students: ParsedStudent[] = []
  const skipped: SkippedLine[] = []

  // Matched on name alone as well as on number: the same child re-imported
  // gets a second login code, and the parent then holds two codes for one
  // student with no way to tell which the teacher is looking at.
  const onRoster = new Set(existing.flatMap(e => [fold(e.name), ...(e.parent ? [normalizePhone(e.parent) ?? ''] : [])].filter(Boolean)))
  const seen = new Set<string>()
  let read = 0

  for (const [i, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (!line) continue
    if (read >= MAX_IMPORT) { read++; continue }

    const cells = line.replace(LIST_PREFIX, '').split(CELL).map(c => c.trim()).filter(Boolean)
    if (!cells.length) continue
    if (isHeader(cells)) continue
    read++

    let parent = ''
    let klass = ''
    const words: string[] = []
    for (const cell of cells) {
      // Order matters: a phone is checked first because a bare "9876543210" is
      // also two digits away from looking like nothing else, and a class is
      // checked before free text so "10" does not become somebody's name.
      const phone = !parent ? normalizePhone(cell) : null
      if (phone) { parent = phone; continue }
      const std = !klass ? normalizeClass(cell) : null
      if (std) { klass = std; continue }
      words.push(cell)
    }

    const name = clampText(words[0] ?? '', LIMITS.name)
    if (name.length < 2) { skipped.push({ line: i + 1, text: line, reason: 'no name on this line' }); continue }

    const key = fold(name)
    if (seen.has(key) || (parent && seen.has(parent))) {
      skipped.push({ line: i + 1, text: line, reason: 'the same student twice in this list' }); continue
    }
    if (onRoster.has(key) || (parent && onRoster.has(parent))) {
      skipped.push({ line: i + 1, text: line, reason: 'already on your roster' }); continue
    }
    seen.add(key)
    if (parent) seen.add(parent)

    students.push({
      name,
      klass: klass || defaultClass,
      parent,
      school: clampText(words[1] ?? '', LIMITS.school),
    })
  }

  // `read` only climbs past the cap on lines that were not looked at, so the
  // subtraction cannot go negative.
  return { students, skipped, overflow: read > MAX_IMPORT ? read - MAX_IMPORT : 0 }
}
