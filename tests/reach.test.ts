import { describe, it, expect } from 'vitest'
import { reachSummary, opened, ACTIVE_DAYS } from '../app/lib/reach'

// The head reads this number and decides whether the app is worth renewing, so
// the boundary between "looking" and "gone" has to be the same boundary every
// week — not one that drifts with the hour she happens to check.

const NOW = Date.parse('2026-08-29T10:00:00.000Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW - days * DAY).toISOString()

describe('reachSummary', () => {
  it('reports zero rather than dividing by an empty roster', () => {
    expect(reachSummary([], NOW)).toEqual({ active: 0, missed: 0, percent: 0 })
  })

  it('names a centre nobody has onboarded', () => {
    expect(reachSummary([{}, {}, {}], NOW)).toEqual({ active: 0, missed: 3, percent: 0 })
  })

  it('counts the last hour of the seventh day as still active', () => {
    expect(reachSummary([{ lastSeenAt: ago(ACTIVE_DAYS) }], NOW).active).toBe(1)
  })

  it('drops a household one second past the window', () => {
    const at = new Date(NOW - ACTIVE_DAYS * DAY - 1000).toISOString()
    expect(reachSummary([{ lastSeenAt: at }], NOW)).toEqual({ active: 0, missed: 1, percent: 0 })
  })

  it('counts a long-lapsed family alongside one that never opened at all', () => {
    expect(reachSummary([{ lastSeenAt: ago(0) }, { lastSeenAt: ago(90) }, {}], NOW))
      .toEqual({ active: 1, missed: 2, percent: 33 })
  })

  it('does not read an unparseable timestamp as a visit', () => {
    expect(reachSummary([{ lastSeenAt: 'not a date' }], NOW)).toEqual({ active: 0, missed: 1, percent: 0 })
  })

  it('rounds the percentage to a whole number the head can say out loud', () => {
    expect(reachSummary([{ lastSeenAt: ago(1) }, { lastSeenAt: ago(2) }, {}], NOW).percent).toBe(67)
  })
})

// The roster filter on the Students screen is the negation of this, so a family
// that never opened must never test as opened.
describe('opened', () => {
  it('is true inside the window and false outside it', () => {
    expect(opened({ lastSeenAt: ago(ACTIVE_DAYS) }, NOW)).toBe(true)
    expect(opened({ lastSeenAt: ago(ACTIVE_DAYS + 1) }, NOW)).toBe(false)
  })

  it('is false for a family with no timestamp at all', () => {
    expect(opened({}, NOW)).toBe(false)
  })
})
