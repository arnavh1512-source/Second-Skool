import { describe, it, expect } from 'vitest'
import { LIMITS, MIN_PASSWORD_LENGTH, capLength, clampText, isWholeNumber, passwordTooShort, safeLinkUrl } from '../app/store/validate'

// These are the boundary guards for every free-text and numeric field a head or
// teacher can type into. An external QA pass stored a 500-character name, an
// attendance of 999999 and a result of 51 out of 50 — each of those went on to
// break a layout or mislead a parent, so the rules are pinned down here.

describe('capLength — live typing', () => {
  it('keeps the trailing space so a full name can be typed', () => {
    // The regression this exists to prevent: setStudentField fires on every
    // keystroke, so trimming here means "John " loses its space the instant it
    // is typed and "John Smith" can never be entered.
    expect(capLength('John ', LIMITS.name)).toBe('John ')
  })

  it('cuts at the limit', () => {
    expect(capLength('x'.repeat(500), LIMITS.name)).toHaveLength(LIMITS.name)
  })

  it('leaves short values untouched', () => {
    expect(capLength('Priya', LIMITS.name)).toBe('Priya')
  })
})

describe('clampText — values headed for the database', () => {
  it('trims and cuts', () => {
    expect(clampText('  Priya  ', LIMITS.name)).toBe('Priya')
    expect(clampText('x'.repeat(500), LIMITS.name)).toHaveLength(LIMITS.name)
  })

  it('collapses a whitespace-only value to empty', () => {
    expect(clampText('   ', LIMITS.name)).toBe('')
  })

  it('trims before cutting, so the limit counts real characters', () => {
    expect(clampText(`   ${'x'.repeat(LIMITS.name)}   `, LIMITS.name)).toHaveLength(LIMITS.name)
  })
})

describe('isWholeNumber', () => {
  it('accepts whole numbers inside the range, including the bounds', () => {
    expect(isWholeNumber('0', 0, 50)).toBe(true)
    expect(isWholeNumber('50', 0, 50)).toBe(true)
    expect(isWholeNumber(' 37 ', 0, 50)).toBe(true)
  })

  it('rejects a mark above the paper total', () => {
    // 51 out of 50 published, notified the class and fed the ranking.
    expect(isWholeNumber('51', 0, 50)).toBe(false)
  })

  it('rejects empty, non-numeric and negative input', () => {
    expect(isWholeNumber('', 0, 50)).toBe(false)
    expect(isWholeNumber('   ', 0, 50)).toBe(false)
    expect(isWholeNumber('abc', 0, 50)).toBe(false)
    expect(isWholeNumber('-1', 0, 50)).toBe(false)
    expect(isWholeNumber('4e2', 0, 500)).toBe(false)
  })

  it('rejects fractions rather than silently rounding them', () => {
    expect(isWholeNumber('1.5', 0, 50)).toBe(false)
    expect(isWholeNumber('49.999', 0, 50)).toBe(false)
  })

  it('rejects NaN and Infinity spellings', () => {
    expect(isWholeNumber('NaN', 0, 50)).toBe(false)
    expect(isWholeNumber('Infinity', 0, 50)).toBe(false)
  })
})

describe('safeLinkUrl', () => {
  it('accepts an https link', () => {
    expect(safeLinkUrl('https://youtu.be/abc')).toBe('https://youtu.be/abc')
  })

  it('trims surrounding whitespace', () => {
    expect(safeLinkUrl('  https://example.com/x  ')).toBe('https://example.com/x')
  })

  it('treats an empty link as absent, not invalid', () => {
    // The field is optional — blank must not raise "invalid link".
    expect(safeLinkUrl('')).toBeNull()
    expect(safeLinkUrl('   ')).toBeNull()
  })

  it('rejects javascript: — the payload that was being stored verbatim', () => {
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull()
    expect(safeLinkUrl('JaVaScRiPt:alert(1)')).toBeNull()
  })

  it('rejects data: and other schemes', () => {
    expect(safeLinkUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeLinkUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejects plain http, because students open these on shared networks', () => {
    expect(safeLinkUrl('http://example.com')).toBeNull()
  })

  it('rejects anything that is not a URL at all', () => {
    expect(safeLinkUrl('youtube.com/watch?v=x')).toBeNull()
    expect(safeLinkUrl('not a link')).toBeNull()
  })
})

describe('LIMITS', () => {
  it('mirrors the database ceilings in 0016_data_integrity.sql', () => {
    // If either side moves, the app and the database disagree and a value the
    // form accepts is rejected by Postgres with an error nobody sees.
    expect(LIMITS).toMatchObject({
      name: 80, klass: 40, school: 120, parent: 20, address: 200,
      period: 40, title: 120, maxMarks: 1000, feeAmount: 10_000_000,
    })
  })
})

describe('passwordTooShort', () => {
  // Supabase enforces its own floor server-side. When ours was lower, an
  // 8-character password passed the field's own check and came back rejected
  // in Supabase's wording, which the head reads as the app being broken.
  it('mirrors the Supabase minimum password length', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10)
  })

  it('rejects anything below the floor', () => {
    expect(passwordTooShort('')).toBe(true)
    expect(passwordTooShort('short')).toBe(true)
    expect(passwordTooShort('nineChars')).toBe(true)
  })

  it('accepts the floor exactly, and above', () => {
    expect(passwordTooShort('tenChars!!')).toBe(false)
    expect(passwordTooShort('a much longer passphrase')).toBe(false)
  })
})
