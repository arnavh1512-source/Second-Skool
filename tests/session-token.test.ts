import { describe, it, expect } from 'vitest'
import { usableToken, CLOCK_SKEW_S } from '../app/lib/session-token'

const NOW_MS = 1_800_000_000_000
const NOW_S = Math.floor(NOW_MS / 1000)

const session = (over: Record<string, unknown> = {}) => ({
  access_token: 'jwt',
  expires_at: NOW_S + 3600,
  ...over,
})

describe('usableToken', () => {
  it('accepts a token with plenty of life left', () => {
    expect(usableToken(session(), NOW_MS)).toBe('jwt')
  })

  // The bug this exists for: getSession() returns storage verbatim, so an
  // expired token used to sail through a presence check and get sent.
  it('rejects a token that has already expired', () => {
    expect(usableToken(session({ expires_at: NOW_S - 1 }), NOW_MS)).toBeNull()
  })

  it('rejects a token expiring inside the skew window, so it cannot die in flight', () => {
    expect(usableToken(session({ expires_at: NOW_S + CLOCK_SKEW_S - 1 }), NOW_MS)).toBeNull()
  })

  it('accepts a token just outside the skew window', () => {
    expect(usableToken(session({ expires_at: NOW_S + CLOCK_SKEW_S + 1 }), NOW_MS)).toBe('jwt')
  })

  it.each([
    ['no session', null],
    ['undefined', undefined],
    ['no token', { expires_at: NOW_S + 3600 }],
    ['a null token', { access_token: null, expires_at: NOW_S + 3600 }],
    ['an empty token', { access_token: '', expires_at: NOW_S + 3600 }],
  ])('returns null for %s', (_label, input) => {
    expect(usableToken(input as never, NOW_MS)).toBeNull()
  })

  // Refusing here would lock out a session that actually works, so an absent or
  // nonsense expiry means "send it and let the server judge".
  it.each([
    ['a missing expiry', { access_token: 'jwt' }],
    ['a null expiry', { access_token: 'jwt', expires_at: null }],
    ['a NaN expiry', { access_token: 'jwt', expires_at: Number.NaN }],
  ])('passes the token through on %s', (_label, input) => {
    expect(usableToken(input as never, NOW_MS)).toBe('jwt')
  })

  it('defaults to the real clock when no time is supplied', () => {
    expect(usableToken(session({ expires_at: Math.floor(Date.now() / 1000) + 3600 }))).toBe('jwt')
    expect(usableToken(session({ expires_at: Math.floor(Date.now() / 1000) - 3600 }))).toBeNull()
  })
})
