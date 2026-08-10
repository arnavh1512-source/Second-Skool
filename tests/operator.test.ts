import { describe, it, expect } from 'vitest'
import { verifyOperator } from '../app/lib/operator'

const OPERATOR = 'arnavh1512@gmail.com'
const google = [{ provider: 'google' }]

const user = (over: Record<string, unknown> = {}) => ({
  email: OPERATOR,
  email_confirmed_at: '2026-01-01T00:00:00Z',
  identities: google,
  ...over,
})

describe('verifyOperator', () => {
  it('accepts the operator on a confirmed Google account', () => {
    expect(verifyOperator(user())).toEqual({ operator: true, reason: 'ok' })
  })

  it('ignores case and surrounding whitespace on the address', () => {
    expect(verifyOperator(user({ email: `  ${OPERATOR.toUpperCase()} ` })).operator).toBe(true)
  })

  it.each([
    ['a different address', { email: 'someone@else.com' }],
    ['no address at all', { email: null }],
    ['an empty address', { email: '' }],
    ['a lookalike with a suffix', { email: `${OPERATOR}.evil.com` }],
    ['a lookalike with a plus tag', { email: 'arnavh1512+admin@gmail.com' }],
  ])('rejects %s', (_label, over) => {
    expect(verifyOperator(user(over))).toEqual({ operator: false, reason: 'not_listed' })
  })

  // The address alone proves nothing if the project ever stops confirming it.
  it('rejects an unconfirmed account holding the address', () => {
    expect(verifyOperator(user({ email_confirmed_at: null }))).toEqual({ operator: false, reason: 'unconfirmed' })
  })

  // The attack this closes: a signed-in user moves their own account onto the
  // operator's address. They cannot also attach a Google identity for it.
  it('rejects a confirmed account that Google does not vouch for', () => {
    expect(verifyOperator(user({ identities: [{ provider: 'email' }] })))
      .toEqual({ operator: false, reason: 'not_google' })
  })

  it('rejects an account with an empty identity list', () => {
    expect(verifyOperator(user({ identities: [] })).operator).toBe(false)
  })

  it('accepts a Google identity alongside a password identity', () => {
    expect(verifyOperator(user({ identities: [{ provider: 'email' }, { provider: 'google' }] })).operator).toBe(true)
  })

  // Failing closed on a missing array would lock the operator out of their own
  // system if the auth API ever stops returning it.
  it('falls back to the confirmed address when identities are absent', () => {
    expect(verifyOperator(user({ identities: undefined })).operator).toBe(true)
    expect(verifyOperator(user({ identities: null })).operator).toBe(true)
  })

  it.each([null, undefined, {}])('rejects a missing user (%s)', u => {
    expect(verifyOperator(u as never)).toEqual({ operator: false, reason: 'not_listed' })
  })
})
