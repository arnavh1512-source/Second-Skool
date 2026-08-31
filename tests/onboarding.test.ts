import { describe, it, expect } from 'vitest'
import { setupProgress } from '../app/lib/onboarding'

describe('setupProgress', () => {
  it('has nothing to show for on an empty centre', () => {
    expect(setupProgress([])).toEqual({ roster: false, register: false, parents: false, done: false })
  })

  it('counts the roster the moment there is one student', () => {
    expect(setupProgress([{}])).toMatchObject({ roster: true, register: false, parents: false })
  })

  it('treats a register marked for anybody as marked', () => {
    // Attendance is marked class by class, so the first day only ever covers
    // part of the roster. Waiting for every student would leave the step open
    // on a centre that is plainly using the register.
    expect(setupProgress([{ attendanceMarked: 4 }, {}])).toMatchObject({ register: true })
  })

  it('does not count a student who is on the register with zero days marked', () => {
    expect(setupProgress([{ attendanceMarked: 0 }])).toMatchObject({ register: false })
  })

  it('counts a family that opened the app at any time, not just this week', () => {
    // Whether they looked *this* week is parent reach — a running measure for
    // a centre already going. Here the only question is whether the code
    // reached the household at all.
    expect(setupProgress([{ lastSeenAt: '2020-01-01T00:00:00Z' }])).toMatchObject({ parents: true })
  })

  it('ignores a missing or unreadable timestamp', () => {
    expect(setupProgress([{}, { lastSeenAt: '' }, { lastSeenAt: 'never' }])).toMatchObject({ parents: false })
  })

  it('is done only when all three have happened', () => {
    expect(setupProgress([{ attendanceMarked: 2, lastSeenAt: '2026-08-30T09:00:00Z' }]).done).toBe(true)
    expect(setupProgress([{ attendanceMarked: 2 }]).done).toBe(false)
    expect(setupProgress([{ lastSeenAt: '2026-08-30T09:00:00Z' }]).done).toBe(false)
  })

  it('reads the three signals off different students', () => {
    // One student marked, a different one opened. The centre is running.
    expect(setupProgress([{ attendanceMarked: 3 }, { lastSeenAt: '2026-08-29T10:00:00Z' }]).done).toBe(true)
  })
})
