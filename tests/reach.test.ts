import { describe, it, expect } from 'vitest'
import { bucketFor, reachSummary, ACTIVE_DAYS } from '../app/lib/reach'

// The head reads this number and decides whether the app is worth renewing, so
// the boundary between "looking" and "gone quiet" has to be the same boundary
// every week — not one that drifts with the hour she happens to check.

const NOW = Date.parse('2026-08-29T10:00:00.000Z')
const DAY = 86_400_000
const ago = (days: number) => new Date(NOW - days * DAY).toISOString()

describe('bucketFor', () => {
  it('counts a household that opened the app today', () => {
    expect(bucketFor(ago(0), NOW)).toBe('active')
  })

  it('counts the last hour of the seventh day as still active', () => {
    expect(bucketFor(ago(ACTIVE_DAYS), NOW)).toBe('active')
  })

  it('drops to quiet one second past the window', () => {
    expect(bucketFor(new Date(NOW - ACTIVE_DAYS * DAY - 1000).toISOString(), NOW)).toBe('quiet')
  })

  it('treats a missing timestamp as never opened', () => {
    expect(bucketFor(undefined, NOW)).toBe('never')
  })

  it('treats an unreadable timestamp as never opened rather than as a visit', () => {
    expect(bucketFor('not a date', NOW)).toBe('never')
  })
})

describe('reachSummary', () => {
  it('reports zero rather than dividing by an empty roster', () => {
    expect(reachSummary([], NOW)).toEqual({ active: 0, quiet: 0, never: 0, total: 0, percent: 0 })
  })

  it('names a centre nobody has onboarded', () => {
    const s = reachSummary([{}, {}, {}], NOW)
    expect(s).toEqual({ active: 0, quiet: 0, never: 3, total: 3, percent: 0 })
  })

  it('splits a mixed roster three ways', () => {
    const s = reachSummary([
      { lastSeenAt: ago(0) },
      { lastSeenAt: ago(2) },
      { lastSeenAt: ago(30) },
      {},
    ], NOW)
    expect(s).toEqual({ active: 2, quiet: 1, never: 1, total: 4, percent: 50 })
  })

  it('rounds the percentage to a whole number the head can say out loud', () => {
    const s = reachSummary([{ lastSeenAt: ago(1) }, {}, {}], NOW)
    expect(s.percent).toBe(33)
  })
})
