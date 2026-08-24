import { describe, it, expect } from 'vitest'
import { isoDay, parseDay, safeDate } from '../app/store/format'

// Every date-only column in this app (meetings.date, assignments.due_date,
// fees.due_date) is written by isoDay and read back into a Date. QA reported a
// meeting picked for 30 August saving as 24 August; the real defect underneath
// was two of them, and both are pinned down here.

describe('parseDay — the round trip that has to hold', () => {
  it('survives isoDay in both directions', () => {
    for (const iso of ['2026-08-30', '2026-01-01', '2026-12-31', '2027-02-28']) {
      expect(isoDay(parseDay(iso)!)).toBe(iso)
    }
  })

  it('reads the day the user picked, not the day UTC was on', () => {
    // The bug this exists to prevent. `new Date('2026-08-30')` is parsed by
    // the spec as UTC midnight, but getDate() reads a *local* component. West
    // of UTC those disagree: a head in New York picked 30 August, the row
    // stored 30 August, and the card rendered 29. parseDay builds the Date
    // from local parts so the two can never drift, whatever TZ the box is in.
    const d = parseDay('2026-08-30')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(30)
  })

  it('ignores a time suffix on a date-only column', () => {
    expect(isoDay(parseDay('2026-08-30T00:00:00Z')!)).toBe('2026-08-30')
  })

  it('refuses empty and malformed input instead of substituting today', () => {
    // saveMeeting and saveAssignment used `new Date(date || Date.now())`, so a
    // blank field silently became today and was announced as a success. They
    // now branch on null, which only works if null is what they get.
    for (const bad of ['', '   ', 'tomorrow', null, undefined]) {
      expect(parseDay(bad as string | null | undefined)).toBeNull()
    }
  })

  it('still parses a timestamptz, so it is safe on mixed columns', () => {
    expect(parseDay('2026-08-30T18:45:00.000Z')).toBeInstanceOf(Date)
  })
})

describe('safeDate — unchanged for timestamps', () => {
  it('returns null rather than letting "Invalid Date" reach a screen', () => {
    expect(safeDate('not a date')).toBeNull()
    expect(safeDate('')).toBeNull()
  })
})
