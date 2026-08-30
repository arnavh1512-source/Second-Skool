// Attendance marked without a working connection, held on the phone until one
// comes back.
//
// The banner used to say "No internet — nothing you enter can be saved right
// now", and it was telling the truth: the register was thrown away. A teacher
// on hotel wifi or dead mobile data marked forty children and lost all of it.
// That is the single most expensive failure this app has, because it happens on
// the screen she touches every working day.
//
// Nothing here touches the network or React. A batch is a plain object, the
// queue is JSON in localStorage, and the replay decision is a pure function, so
// the rule that decides whether a stale mark may overwrite a live one can be
// tested without a database.

export type AttStatus = 'Present' | 'Absent'

export type QueuedMark = {
  studentId: string
  /** The student_code, kept so the absence push can still reach the parent when
   *  the batch finally syncs. The roster it came from is long gone by then. */
  code: string
  /** Only ever shown back to the teacher in the conflict list. */
  name: string
  status: AttStatus
}

export type QueuedBatch = {
  id: string
  /** The day she marked, not the day it syncs. A register queued on Tuesday
   *  evening and drained on Wednesday morning is Tuesday's register; filing it
   *  under Wednesday would mark a class that never met and leave Tuesday blank. */
  date: string
  marks: QueuedMark[]
}

/** A queued mark that was not applied, because the register already had an
 *  answer for that child and it was not hers. */
export type AttConflict = {
  name: string
  date: string
  mine: AttStatus
  theirs: string
}

export type Resolution = {
  rows: { student_id: string; date: string; status: AttStatus }[]
  /** The subset of `rows` that is an absence, for the parent push. */
  absent: QueuedMark[]
  conflicts: AttConflict[]
}

/**
 * Decide what a queued batch may still write.
 *
 * The rule: **a queued mark writes only where the register has no answer yet.**
 *
 * Her marks were made offline, so none of them reached the server; any row that
 * exists for that child and day was therefore written by somebody who was
 * online, after she lost signal. Their mark is current and hers is stale, so
 * hers does not win — it surfaces as a conflict she can look at and re-enter in
 * ten seconds if she disagrees.
 *
 * This is deliberately narrower than "her own rows win". It cannot overwrite
 * anyone, and the case it gives up is small: if she had already saved the class
 * online earlier that day and then corrected one child offline, the correction
 * comes back as a conflict rather than being applied. A false conflict costs
 * her one tap. A wrong overwrite costs a child a wrong absence and a parent a
 * push about it, which is the one message a centre cannot take back.
 *
 * Where the register already agrees with her, nothing is written and nothing is
 * reported — two people marking the same child absent is not a disagreement.
 *
 * @param existing Rows already in the database for this batch's date, for any
 *   of its students. Read immediately before this call.
 */
export function resolveBatch(
  batch: QueuedBatch,
  existing: readonly { student_id: string; status: string }[],
): Resolution {
  const held = new Map(existing.map((r) => [r.student_id, r.status]))
  const res: Resolution = { rows: [], absent: [], conflicts: [] }

  for (const mark of batch.marks) {
    const theirs = held.get(mark.studentId)
    if (theirs === undefined) {
      res.rows.push({ student_id: mark.studentId, date: batch.date, status: mark.status })
      if (mark.status === 'Absent') res.absent.push(mark)
    } else if (theirs !== mark.status) {
      res.conflicts.push({ name: mark.name, date: batch.date, mine: mark.status, theirs })
    }
  }
  return res
}

// ---------------------------------------------------------------------------

const KEY = 'ss-att-queue-v1'

const isMark = (m: unknown): m is QueuedMark => {
  const v = m as Partial<QueuedMark>
  return !!v && typeof v.studentId === 'string' && !!v.studentId
    && typeof v.name === 'string' && typeof v.code === 'string'
    && (v.status === 'Present' || v.status === 'Absent')
}

const isBatch = (b: unknown): b is QueuedBatch => {
  const v = b as Partial<QueuedBatch>
  return !!v && typeof v.id === 'string' && !!v.id
    && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
    && Array.isArray(v.marks) && v.marks.every(isMark)
}

/** Validated on the way in, every time. This is localStorage: the user can edit
 *  it, another tab can half-write it, and a build from six months ago may have
 *  written a shape this one no longer understands. Anything that does not parse
 *  is dropped rather than crashing the screen it is read on. */
export function parseQueue(raw: string | null): QueuedBatch[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isBatch) : []
  } catch {
    return []
  }
}

export function loadQueue(): QueuedBatch[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return parseQueue(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

/** Storage can be full or blocked outright (private mode on iOS throws on
 *  write). Failing here must not take the save with it — the marks are still in
 *  memory and still sync on this run; only surviving a reload is lost. */
export function saveQueue(queue: readonly QueuedBatch[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    if (queue.length) localStorage.setItem(KEY, JSON.stringify(queue))
    else localStorage.removeItem(KEY)
  } catch { /* nothing useful to say to a teacher about a storage quota */ }
}

/** Marks, not batches — "3 registers waiting" means nothing to her, "84 marks
 *  waiting" is the size of what she would lose. */
export const queuedMarkCount = (queue: readonly QueuedBatch[]): number =>
  queue.reduce((n, b) => n + b.marks.length, 0)
