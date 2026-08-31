import { describe, it, expect } from 'vitest'
import { atRisk } from '../app/lib/at-risk'

const row = (student_id: string, date: string, status: string) => ({ student_id, date, status })

describe('atRisk', () => {
  it('finds nobody in an empty register', () => {
    expect(atRisk([])).toEqual({})
  })

  it('leaves a student alone below the threshold', () => {
    expect(atRisk([
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
    ])).toEqual({})
  })

  it('flags a student absent for three sessions running', () => {
    expect(atRisk([
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
      row('a', '2026-08-27', 'Absent'),
      row('a', '2026-08-26', 'Present'),
    ])).toEqual({ a: { studentId: 'a', missed: 3, lastPresent: '2026-08-26' } })
  })

  it('ignores an old run of absences that has since ended', () => {
    // The whole point is who has stopped coming, not who once had a bad month.
    expect(atRisk([
      row('a', '2026-08-29', 'Present'),
      row('a', '2026-08-28', 'Absent'),
      row('a', '2026-08-27', 'Absent'),
      row('a', '2026-08-26', 'Absent'),
      row('a', '2026-08-25', 'Absent'),
    ])).toEqual({})
  })

  it('treats leave as an explained absence that breaks the run', () => {
    // A family who told the centre is the one case already handled.
    expect(atRisk([
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
      row('a', '2026-08-27', 'Leave'),
      row('a', '2026-08-26', 'Absent'),
    ])).toEqual({})
  })

  it('reads the run regardless of the order rows arrive in', () => {
    expect(atRisk([
      row('a', '2026-08-27', 'Absent'),
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
    ]).a.missed).toBe(3)
  })

  it('counts a day marked twice once, keeping the correction', () => {
    // Marked absent, then corrected to present later in the day.
    expect(atRisk([
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
      row('a', '2026-08-27', 'Absent'),
      row('a', '2026-08-27', 'Present'),
    ])).toEqual({})
  })

  it('flags a student who has never once been marked present', () => {
    // Enrolled, added to the register, never turned up. lastPresent has no
    // answer and the screen says so rather than inventing a date.
    expect(atRisk([
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
      row('a', '2026-08-27', 'Absent'),
    ])).toEqual({ a: { studentId: 'a', missed: 3, lastPresent: null } })
  })

  it('skips rows with a missing or unusable id, date or status', () => {
    expect(atRisk([
      { student_id: null, date: '2026-08-29', status: 'Absent' },
      { student_id: 'a', date: '', status: 'Absent' },
      { student_id: 'a', date: '2026-08-28', status: 7 },
      row('a', '2026-08-27', 'Absent'),
    ])).toEqual({})
  })

  it('counts the run for each student separately', () => {
    const out = atRisk([
      row('a', '2026-08-29', 'Absent'),
      row('a', '2026-08-28', 'Absent'),
      row('a', '2026-08-27', 'Absent'),
      row('b', '2026-08-29', 'Absent'),
      row('b', '2026-08-28', 'Absent'),
      row('b', '2026-08-27', 'Absent'),
      row('b', '2026-08-26', 'Absent'),
      row('c', '2026-08-29', 'Present'),
    ])
    expect(out.a.missed).toBe(3)
    expect(out.b.missed).toBe(4)
    expect(out.c).toBeUndefined()
  })
})
