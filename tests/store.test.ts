import { describe, it, expect } from 'vitest'
import { genStudentCode, mapSnapshot, initials, feeColor, stuGrade } from '../app/store'

describe('genStudentCode', () => {
  it('has the TUT- prefix and 8 code characters', () => {
    expect(genStudentCode()).toMatch(/^TUT-[A-Z2-9]{8}$/)
  })

  it('never uses confusable characters (O, 0, I, 1, L)', () => {
    for (let i = 0; i < 100; i++) {
      expect(genStudentCode().slice(4)).not.toMatch(/[O0I1L]/)
    }
  })

  it('is effectively unique across many draws', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => genStudentCode()))
    expect(codes.size).toBe(2000)
  })
})

describe('initials', () => {
  it('takes first letters, max two, uppercased', () => {
    expect(initials('arjun mehta')).toBe('AM')
    expect(initials('ravi')).toBe('R')
    expect(initials('a b c')).toBe('AB')
  })
})

describe('feeColor', () => {
  // Tokens, not hex: these colours differ between light and dark, and the only
  // thing worth pinning is that each status still gets its own one.
  it('maps each fee status to its colour', () => {
    expect(feeColor('Paid').c).toBe('var(--color-td-green)')
    expect(feeColor('Due').c).toBe('var(--color-td-amber)')
    expect(feeColor('Overdue').c).toBe('var(--color-td-red)')
  })
})

describe('stuGrade', () => {
  it('grades by percentage band', () => {
    expect(stuGrade(95).g).toBe('A+')
    expect(stuGrade(85).g).toBe('A')
    expect(stuGrade(72).g).toBe('B')
    expect(stuGrade(50).g).toBe('C')
  })
})

describe('mapSnapshot', () => {
  const snap = {
    student: { dbId: 'd1', name: 'Arjun', klass: 'Class 10-B', school: 'DPS', code: 'TUT-ABCDEFGH', parent: '+91 90000', address: 'X', feeStatus: 'Due' },
    attendance: [
      { date: '2026-06-01', status: 'Present' },
      { date: '2026-06-02', status: 'Absent' },
    ],
    results: [{ subject: 'Mathematics', test: 'Unit 1', date: '2026-06-01', marks: 18, total: 20 }],
    fees: [
      { period: 'June 2026', amount: 5000, status: 'Paid', dueDate: '2026-06-01', paidDate: '2026-06-02' },
      { period: 'July 2026', amount: 5000, status: 'Due', dueDate: '2026-07-01', paidDate: null },
    ],
    notifications: [{ title: 'Test Reminder', detail: 'Tomorrow', icon: '📝', createdAt: new Date().toISOString() }],
    teachers: [{ name: 'Ravi', subject: 'Mathematics', experience: 5, qualification: 'M.Sc', rating: 4.5, about: 'x' }],
    rankings: { Mathematics: [['Arjun', 90] as [string, number], ['Neha', 80] as [string, number]] },
  }
  const r = mapSnapshot(snap)

  it('builds one student with a computed attendance %', () => {
    expect(r.students?.length).toBe(1)
    expect(r.students?.[0].name).toBe('Arjun')
    expect(r.students?.[0].attendance).toBe(50) // 1 present of 2
    expect(r.currentStudentDbId).toBe('d1')
  })

  it('maps results, paid-only fee history, and the pending fee', () => {
    expect(r.stuResults?.[0].marks).toBe(18)
    expect(r.stuFeeHistory?.length).toBe(1)
    expect(r.stuPendingFee?.period).toBe('July 2026')
  })

  it('passes through rankings and stringifies teacher rating', () => {
    expect(r.rankData?.Mathematics?.[0]?.name).toBe('Arjun')
    expect(r.teachers?.[0].rating).toBe('4.5')
  })

  // The [name, score] pair is what a database that has not had the ranking
  // migration applied still sends. It has to keep working, and it has to be
  // obvious downstream that it carries no identity.
  it('reads a legacy [name, score] board and leaves its ids null', () => {
    expect(r.rankData?.Mathematics?.[0]).toEqual({ id: null, name: 'Arjun', klass: null, score: 90 })
    expect(r.rankData?.Mathematics?.[1]).toEqual({ id: null, name: 'Neha', klass: null, score: 80 })
  })

  it('keeps two students who share a name apart on the current board', () => {
    const mapped = mapSnapshot({
      student: { dbId: 'd1', code: 'c1' },
      rankings: { Mathematics: [
        { id: 'd1', name: 'Arjun Patel', score: 91 },
        { id: 'd9', name: 'Arjun Patel', score: 62 },
      ] },
    })
    const board = mapped.rankData?.Mathematics ?? []
    expect(board.length).toBe(2)
    expect(board.map(x => x.id)).toEqual(['d1', 'd9'])
    // Two rows, one name — only the id can say which of them is the reader.
    expect(board.findIndex(x => x.id === 'd1')).toBe(0)
  })

  // A board spanning classes is only readable if each row says which class it
  // belongs to; the screen groups on this.
  it('carries the class through on a board that spans classes', () => {
    const mapped = mapSnapshot({
      student: { dbId: 'd1', code: 'c1' },
      rankings: { Mathematics: [
        { id: 'd1', name: 'Riya', klass: 'Class 10', score: 91 },
        { id: 'd9', name: 'Aarav', klass: 'Class 9', score: 88 },
      ] },
    })
    expect((mapped.rankData?.Mathematics ?? []).map(x => x.klass)).toEqual(['Class 10', 'Class 9'])
  })

  it('survives a board row with neither id nor name', () => {
    const mapped = mapSnapshot({
      student: { dbId: 'd1', code: 'c1' },
      rankings: { Science: [{}] },
    })
    expect(mapped.rankData?.Science?.[0]).toEqual({ id: null, name: '', klass: null, score: 0 })
  })

  it('handles a sparse snapshot without throwing', () => {
    const empty = mapSnapshot({ student: { dbId: 'd', code: 'c' } })
    expect(empty.stuResults).toEqual([])
    expect(empty.stuPendingFee).toBeNull()
    expect(empty.students?.[0].attendance).toBe(0)
    expect(empty.centreName).toBe('')
    expect(empty.centreLogo).toBe('')
  })

  it('passes through centre branding (white-label logo)', () => {
    const branded = mapSnapshot({
      student: { dbId: 'd', code: 'c' },
      centre: { name: 'Bright Future Tuition', logo_url: 'data:image/png;base64,AAA' },
    })
    expect(branded.centreName).toBe('Bright Future Tuition')
    expect(branded.centreLogo).toBe('data:image/png;base64,AAA')
  })

  it('computes the 30-day monthly summary from raw dates', () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0]
    const old = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0]
    const r = mapSnapshot({
      student: { dbId: 'd', code: 'c' },
      attendance: [
        { date: recent, status: 'Present' },
        { date: recent, status: 'Absent' },
        { date: old, status: 'Present' }, // outside the 30-day window
      ],
      results: [
        { subject: 'Maths', test: 'T1', date: recent, marks: 40, total: 50 },
        { subject: 'Maths', test: 'T0', date: old, marks: 10, total: 50 },
      ],
    })
    expect(r.stuMonthly?.attPresent).toBe(1)
    expect(r.stuMonthly?.attTotal).toBe(2)
    expect(r.stuMonthly?.tests).toBe(1)
    expect(r.stuMonthly?.avgPct).toBe(80)
  })

  it('maps class assignments for the student', () => {
    const r = mapSnapshot({
      student: { dbId: 'd', code: 'c', klass: 'Class 10-B' },
      assignments: [
        { title: 'Algebra WS 5', subject: 'Mathematics', due: '2026-07-05', instructions: 'Do Q1-10' },
        { title: 'Essay', subject: 'English', due: '2026-07-03', instructions: '' },
      ],
    })
    expect(r.stuAssignments?.length).toBe(2)
    expect(r.stuAssignments?.[0].title).toBe('Algebra WS 5')
    expect(r.stuAssignments?.[0].subject).toBe('Mathematics')
  })

  it('groups the class timetable by day', () => {
    const r = mapSnapshot({
      student: { dbId: 'd', code: 'c', klass: 'Class 10-B' },
      timetable: [
        { day: 'Mon', start: '09:00', end: '10:00', subject: 'Mathematics', room: 'R1' },
        { day: 'Mon', start: '10:00', end: '11:00', subject: 'Physics', room: 'R2' },
        { day: 'Tue', start: '09:00', end: '10:00', subject: 'English', room: 'R1' },
      ],
    })
    expect(r.timetableData?.Mon?.length).toBe(2)
    expect(r.timetableData?.Tue?.length).toBe(1)
    expect(r.timetableData?.Mon?.[0]?.[2]).toBe('Mathematics')
  })
})
