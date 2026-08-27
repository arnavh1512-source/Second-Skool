import { describe, it, expect } from 'vitest'
import { validateReport, buildDiagnostics, AREAS, FREQUENCIES } from '../app/lib/support'

// The validation bounds are the client-side mirror of the CHECK constraints and
// the raise exceptions in 0023. If they drift, a reporter gets a raw Postgres
// error instead of a sentence telling them what to fix.

const ok = {
  intent: 'Mark attendance for Class 10',
  outcome: 'The save button does nothing',
  area: 'Attendance',
  frequency: 'always' as const,
}

describe('validateReport', () => {
  it('accepts an ordinary report', () => {
    expect(validateReport(ok)).toBeNull()
  })

  it('asks for the first answer when it is too short to act on', () => {
    expect(validateReport({ ...ok, intent: 'hi' })).toBe('Tell us what you were trying to do')
  })

  it('rejects a first answer past the column limit', () => {
    expect(validateReport({ ...ok, intent: 'x'.repeat(121) })).toBe('Tell us what you were trying to do')
  })

  it('counts trimmed length, so whitespace cannot pad an answer', () => {
    expect(validateReport({ ...ok, outcome: '   a   ' })).toBe('Tell us what happened instead')
  })

  it('requires an area, because the app cannot guess which feature broke', () => {
    expect(validateReport({ ...ok, area: '' })).toBe('Choose which part of the app')
  })

  it('offers areas in the words a teacher uses, and a way out', () => {
    expect(AREAS).toContain('Attendance')
    expect(AREAS).toContain('Something else')
    expect(FREQUENCIES.map(f => f.value)).toEqual(['always', 'sometimes', 'first'])
  })
})

// The diagnostics block exists so a report is answerable without opening the
// reporter's centre — which, since e69b2f7, is not possible at all. It must
// never become a second copy of their data, so it carries only facts about the
// build and the device.

describe('buildDiagnostics', () => {
  it('keeps the facts that identify a build and a device', () => {
    const d = buildDiagnostics({
      version: 'abc1234',
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      width: 412,
      height: 915,
      lastError: null,
    })
    expect(d).toEqual({
      version: 'abc1234',
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      viewport: '412x915',
      lastError: null,
    })
  })

  it('caps a runaway error string instead of storing a stack dump', () => {
    const d = buildDiagnostics({ version: 'a', userAgent: 'x', width: 1, height: 1, lastError: 'E'.repeat(5000) })
    expect(d.lastError!.length).toBe(300)
  })

  it('caps a user agent, which is attacker-controlled text', () => {
    const d = buildDiagnostics({ version: 'a', userAgent: 'U'.repeat(5000), width: 1, height: 1, lastError: null })
    expect(d.userAgent.length).toBe(200)
  })
})
