// Correcting a test that has already been published.
//
// Two things make an edit different from the original publish. The first is
// that a blank box means "leave this mark alone", not "this student scored
// nothing" — a published mark can be corrected but never taken away, so the
// only way a row disappears is if somebody deletes it in the database on
// purpose. The second is the order of the writes, which the integrity triggers
// in 0016 care about even though nothing else does.

export interface MarkEntry {
  studentId: string
  /** What the teacher has in the box right now. Blank means untouched. */
  typed: string
  /** What is already published for this student, or null if nothing is. */
  published: number | null
}

export interface MarkRow { test_id: string; student_id: string; marks: number }

/**
 * The rows an edit actually has to write: a mark that was typed and differs
 * from the one already published, or one for a student who had none. Marks
 * that are unchanged are left out so a correction to one student does not
 * re-stamp the whole class as edited.
 */
export function changedMarks(testId: string, entries: MarkEntry[]): MarkRow[] {
  const rows: MarkRow[] = []
  for (const { studentId, typed, published } of entries) {
    if (typed.trim() === '') continue
    const marks = Number(typed)
    if (published !== null && published === marks) continue
    rows.push({ test_id: testId, student_id: studentId, marks })
  }
  return rows
}

/**
 * Which write goes first when the maximum changes too.
 *
 * A mark may not exceed its test's maximum, and a maximum may not drop below a
 * mark already recorded — both enforced by triggers, in both directions. So
 * raising the maximum means the test row has to move first or the higher marks
 * are rejected, and lowering it means the marks have to come down first or the
 * test row is. Doing it in one fixed order fails half the time.
 */
export function writeOrder(oldMax: number, newMax: number): 'test-first' | 'marks-first' {
  return newMax >= oldMax ? 'test-first' : 'marks-first'
}
