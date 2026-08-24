import { describe, it, expect } from 'vitest'
import { changedNothing, NOT_SAVED } from '../app/store/db'

// PostgREST answers an UPDATE that matched zero rows exactly like one that
// matched every row: no error, no complaint. Every write in this app that
// targets a row which *must* exist now asks for the affected ids back and runs
// them through changedNothing, so the guard itself is worth pinning down —
// getting it backwards would turn every successful save into a false failure.

describe('changedNothing', () => {
  it('is true for the silent no-op: no error, no rows', () => {
    // The real shape of an update filtered out by RLS, or aimed at a row that
    // was deleted in another session. This is the whole reason the helper
    // exists — a head was told "Centre renamed" while nothing changed.
    expect(changedNothing({ data: [], error: null })).toBe(true)
  })

  it('is true when data comes back null rather than empty', () => {
    expect(changedNothing({ data: null, error: null })).toBe(true)
  })

  it('is false when a row was actually written', () => {
    expect(changedNothing({ data: [{ id: 'abc' }], error: null })).toBe(false)
  })

  it('is false for several rows', () => {
    expect(changedNothing({ data: [{ id: 'a' }, { id: 'b' }], error: null })).toBe(false)
  })

  it('defers to the error path instead of claiming nothing changed', () => {
    // A real error is reported by the caller's own error branch with a message
    // specific to the operation. If this returned true as well, the caller
    // would show two toasts for one failure and the second — being generic —
    // would be the one the single-slot toast left on screen.
    expect(changedNothing({ data: [], error: { message: 'boom' } })).toBe(false)
    expect(changedNothing({ data: null, error: { message: 'boom' } })).toBe(false)
  })
})

describe('NOT_SAVED', () => {
  it('names an action the teacher can actually take', () => {
    // The two real causes are a row RLS will not let her touch and a row that
    // no longer exists, and both are fixed by refreshing or signing back in.
    // A message that only said "failed" sent her tapping Save again forever.
    expect(NOT_SAVED).toMatch(/refresh/i)
    expect(NOT_SAVED).toMatch(/sign out/i)
  })
})
