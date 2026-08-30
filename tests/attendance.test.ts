import { describe, it, expect } from 'vitest'
import { totalsByStudent, countDailyRows, attendancePct, pickAttendanceClass, marksForDay, seedMarks } from '../app/lib/attendance'

describe('totalsByStudent', () => {
  it('indexes server-computed totals by student id', () => {
    expect(totalsByStudent([
      { student_id: 'a', present: 18, total: 20 },
      { student_id: 'b', present: 5, total: 20 },
    ])).toEqual({ a: { p: 18, t: 20 }, b: { p: 5, t: 20 } })
  })

  it('survives a row with no student id', () => {
    expect(totalsByStudent([{ student_id: '', present: 1, total: 1 }])).toEqual({})
  })

  it('coerces nulls from the database to zero rather than NaN', () => {
    const rows = [{ student_id: 'a', present: null, total: null }] as unknown as { student_id: string; present: number; total: number }[]
    expect(totalsByStudent(rows)).toEqual({ a: { p: 0, t: 0 } })
  })
})

describe('countDailyRows', () => {
  it('counts present against total per student', () => {
    expect(countDailyRows([
      { student_id: 'a', status: 'Present' },
      { student_id: 'a', status: 'Absent' },
      { student_id: 'a', status: 'Leave' },
      { student_id: 'b', status: 'Present' },
    ])).toEqual({ a: { p: 1, t: 3 }, b: { p: 1, t: 1 } })
  })

  it('treats Leave as attended-not-present, i.e. it counts against the total', () => {
    expect(countDailyRows([{ student_id: 'a', status: 'Leave' }])).toEqual({ a: { p: 0, t: 1 } })
  })

  it('ignores rows with no usable student id', () => {
    expect(countDailyRows([{ student_id: null, status: 'Present' }, { status: 'Present' }])).toEqual({})
  })
})

describe('attendancePct', () => {
  it('rounds to a whole percent', () => {
    expect(attendancePct({ p: 2, t: 3 })).toBe(67)
    expect(attendancePct({ p: 18, t: 20 })).toBe(90)
  })

  it('returns null rather than 0 when nothing has been marked', () => {
    // 0% and "not marked yet" mean very different things to a parent, so the
    // caller must be able to tell them apart.
    expect(attendancePct({ p: 0, t: 0 })).toBeNull()
    expect(attendancePct(undefined)).toBeNull()
  })

  it('returns 0 when marked and never present', () => {
    expect(attendancePct({ p: 0, t: 12 })).toBe(0)
  })

  it('never divides by a negative total', () => {
    expect(attendancePct({ p: 1, t: -5 })).toBeNull()
  })
})

describe('the bug this replaces', () => {
  it('shows how a truncated row set inflates the percentage', () => {
    // A student marked absent for the first 10 days and present for the next
    // 10 is at 50%. If the oldest rows fall off the fetch cap, the browser only
    // sees the recent present ones and reports 100% — silently, to a parent.
    const full = [
      ...Array.from({ length: 10 }, () => ({ student_id: 'a', status: 'Absent' })),
      ...Array.from({ length: 10 }, () => ({ student_id: 'a', status: 'Present' })),
    ]
    expect(attendancePct(countDailyRows(full).a)).toBe(50)

    const truncated = full.slice(10) // newest-first cap drops the older half
    expect(attendancePct(countDailyRows(truncated).a)).toBe(100)

    // The server-side totals are unaffected by what the browser managed to fetch.
    expect(attendancePct(totalsByStudent([{ student_id: 'a', present: 10, total: 20 }]).a)).toBe(50)
  })
})

describe('pickAttendanceClass', () => {
  const classes = ['Class 9', 'Class 10', 'Class 12']

  // The reported bug: the stored choice starts empty and nothing sets it until a
  // chip is tapped, so Mark Attendance opened with chips but an empty roster.
  it('falls back to the first class when nothing has been chosen', () => {
    expect(pickAttendanceClass(classes, '')).toBe('Class 9')
  })

  it('keeps a class the teacher actually picked', () => {
    expect(pickAttendanceClass(classes, 'Class 12')).toBe('Class 12')
  })

  // Delete the last student of a class, or rename it, and the stored choice
  // names something that no longer exists.
  it('falls back when the stored class has gone away', () => {
    expect(pickAttendanceClass(classes, 'Class 11')).toBe('Class 9')
  })

  it('returns empty only when there are genuinely no classes', () => {
    expect(pickAttendanceClass([], '')).toBe('')
    expect(pickAttendanceClass([], 'Class 10')).toBe('')
  })

  it('never invents a class that is not on the list', () => {
    for (const stored of ['', 'Class 10', 'nonsense']) {
      const picked = pickAttendanceClass(classes, stored)
      expect(classes).toContain(picked)
    }
  })
})

describe('marksForDay', () => {
  const rows = [
    { student_id: 'a', date: '2026-08-31', status: 'Absent' },
    { student_id: 'b', date: '2026-08-31', status: 'Present' },
    { student_id: 'c', date: '2026-08-30', status: 'Absent' },
  ]

  it('keeps only the day asked for', () => {
    expect(marksForDay(rows, '2026-08-31')).toEqual({ a: 'Absent', b: 'Present' })
  })

  it('is empty for a day with nothing recorded', () => {
    expect(marksForDay(rows, '2026-09-01')).toEqual({})
  })

  it('ignores rows with no usable student or status', () => {
    // The fetch is capped and shaped by the server; a row missing its id would
    // otherwise land under the key "undefined" and mark a student who is not
    // in the class.
    const junk = [
      { date: '2026-08-31', status: 'Absent' },
      { student_id: '', date: '2026-08-31', status: 'Absent' },
      { student_id: 'd', date: '2026-08-31' },
      { student_id: 'e', date: '2026-08-31', status: 'Present' },
    ]
    expect(marksForDay(junk, '2026-08-31')).toEqual({ e: 'Present' })
  })
})

describe('seedMarks', () => {
  const roster = [{ dbId: 'a', id: 'S1' }, { dbId: 'b', id: 'S2' }, { dbId: 'c', id: 'S3' }]

  // The bug: the screen opened blank every time, so a teacher who marked four
  // children absent, left and came back saw a clean register and no evidence
  // her work had happened.
  it('shows the marks the centre already has', () => {
    expect(seedMarks(roster, { a: 'Absent' }, {})).toEqual({ a: 'absent', b: 'present', c: 'present' })
  })

  it('defaults an unmarked student to present', () => {
    expect(seedMarks(roster, {}, {})).toEqual({ a: 'present', b: 'present', c: 'present' })
  })

  it('lets a mark still queued on this phone win', () => {
    // It is the newest thing she did; it simply has not been sent yet.
    expect(seedMarks(roster, { a: 'Present' }, { a: 'Absent' })).toMatchObject({ a: 'absent' })
  })

  it('reads a status the toggle cannot produce as present', () => {
    // The column also allows 'Leave'. A two-state toggle cannot show it, and
    // guessing 'absent' would tell a parent their child missed the class.
    expect(seedMarks(roster, { a: 'Leave' }, {})).toMatchObject({ a: 'present' })
  })

  it('keys by the student, not by their slot in the roster', () => {
    // The roster is re-fetched newest-first on every refresh, so an
    // index-keyed seed lands somebody else's mark on the wrong child.
    expect(Object.keys(seedMarks(roster, {}, {}))).toEqual(['a', 'b', 'c'])
  })

  it('falls back to the student code before the uuid exists', () => {
    // A student added moments ago has no uuid until the insert returns.
    expect(seedMarks([{ id: 'S9' }], {}, {})).toEqual({ S9: 'present' })
  })

  it('skips a row with no handle at all rather than keying on empty string', () => {
    expect(seedMarks([{}], {}, {})).toEqual({})
  })
})
