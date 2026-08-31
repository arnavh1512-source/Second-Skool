import { describe, it, expect } from 'vitest'
import { stageOf, firstClaims, funnelSummary } from '../app/lib/funnel'

// The head's list of 48 families splits four ways and each way is a different
// phone call. Getting a family into the wrong bucket sends the wrong call, so
// the boundaries are worth pinning down.

const NOW = Date.parse('2026-09-01T10:00:00Z')
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

describe('stageOf', () => {
  it('a family that opened the app this week is active', () => {
    expect(stageOf({ lastSeenAt: ago(2) }, Date.parse(ago(60)), NOW)).toBe('active')
  })

  it('a family that has never opened it at all is dark', () => {
    expect(stageOf({}, null, NOW)).toBe('dark')
    // An unparseable stamp is not evidence anybody looked.
    expect(stageOf({ lastSeenAt: 'not a date' }, null, NOW)).toBe('dark')
  })

  it('a family whose last visit was the day they set the phone up never came back', () => {
    expect(stageOf({ lastSeenAt: ago(40) }, Date.parse(ago(40)), NOW)).toBe('once')
  })

  it('a family that was still looking a week after setup went quiet later', () => {
    expect(stageOf({ lastSeenAt: ago(30) }, Date.parse(ago(37)), NOW)).toBe('quiet')
  })

  it('a stale family with no phone on record is quiet, not dark', () => {
    // They opened the app before the device era. Something got them in once;
    // calling that a delivery failure would send the wrong conversation.
    expect(stageOf({ lastSeenAt: ago(90) }, null, NOW)).toBe('quiet')
  })
})

describe('firstClaims', () => {
  it('keeps the earliest claim per student and ignores the rest', () => {
    const claims = firstClaims([
      { studentId: 'a', when: ago(10) },
      { studentId: 'a', when: ago(50) },
      { studentId: 'b', when: ago(3) },
      { studentId: undefined, when: ago(3) },
      { studentId: 'c', when: 'not a date' },
    ])
    expect(claims).toEqual({ a: Date.parse(ago(50)), b: Date.parse(ago(3)) })
  })
})

describe('funnelSummary', () => {
  it('splits the roster four ways', () => {
    const students = [
      { dbId: 'a', lastSeenAt: ago(1) },   // active
      { dbId: 'b' },                        // dark
      { dbId: 'c', lastSeenAt: ago(40) },  // once — claimed the same day
      { dbId: 'd', lastSeenAt: ago(20) },  // quiet — kept coming, then stopped
      { dbId: 'e', lastSeenAt: ago(99) },  // quiet — no phone on record
    ]
    const devices = [
      { studentId: 'a', when: ago(60) },
      { studentId: 'c', when: ago(40) },
      { studentId: 'd', when: ago(60) },
    ]
    expect(funnelSummary(students, devices, NOW)).toEqual({ active: 1, dark: 1, once: 1, quiet: 2 })
  })

  it('counts an empty roster as nothing at all', () => {
    expect(funnelSummary([], [], NOW)).toEqual({ active: 0, dark: 0, once: 0, quiet: 0 })
  })
})
