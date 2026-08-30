import { describe, it, expect } from 'vitest'
import { safeLink, signWithCentre, validatePushBody, validateStudentRequest, createRateLimiter, rateLimit } from '../app/lib/push-guard'

describe('safeLink', () => {
  it('keeps a same-app relative path', () => {
    expect(safeLink('/fees')).toBe('/fees')
    expect(safeLink('/students/TUT-ABCDEFGH')).toBe('/students/TUT-ABCDEFGH')
  })

  it('rejects protocol-relative URLs (//host)', () => {
    expect(safeLink('//evil.com')).toBe('/')
    expect(safeLink('//evil.com/phish')).toBe('/')
  })

  it('rejects absolute and scheme links', () => {
    expect(safeLink('http://evil.com')).toBe('/')
    expect(safeLink('https://evil.com')).toBe('/')
    expect(safeLink('javascript:alert(1)')).toBe('/')
    expect(safeLink('data:text/html,x')).toBe('/')
  })

  it('rejects non-strings and empty input', () => {
    expect(safeLink(undefined)).toBe('/')
    expect(safeLink(null)).toBe('/')
    expect(safeLink(42)).toBe('/')
    expect(safeLink('')).toBe('/')
    expect(safeLink('fees')).toBe('/') // no leading slash
  })
})

describe('validatePushBody', () => {
  const ok = (over: Record<string, unknown> = {}) => ({ title: 'Hi', ...over })

  it('accepts a minimal valid body', () => {
    const r = validatePushBody(ok())
    expect(r.ok).toBe(true)
  })

  it('accepts optional body + studentCodes', () => {
    const r = validatePushBody(ok({ body: 'x', studentCodes: ['TUT-A', 'TUT-B'], notifyHead: true }))
    expect(r).toEqual({ ok: true, value: expect.objectContaining({ title: 'Hi' }) })
  })

  it('rejects a missing/empty/non-string title', () => {
    expect(validatePushBody({})).toEqual({ ok: false, error: 'bad title' })
    expect(validatePushBody({ title: '' })).toEqual({ ok: false, error: 'bad title' })
    expect(validatePushBody({ title: 123 })).toEqual({ ok: false, error: 'bad title' })
  })

  it('rejects a title over 120 chars', () => {
    expect(validatePushBody({ title: 'a'.repeat(121) })).toEqual({ ok: false, error: 'bad title' })
    expect(validatePushBody({ title: 'a'.repeat(120) }).ok).toBe(true) // boundary
  })

  it('rejects a body over 500 chars or non-string', () => {
    expect(validatePushBody(ok({ body: 'a'.repeat(501) }))).toEqual({ ok: false, error: 'bad body' })
    expect(validatePushBody(ok({ body: 5 }))).toEqual({ ok: false, error: 'bad body' })
    expect(validatePushBody(ok({ body: 'a'.repeat(500) })).ok).toBe(true) // boundary
  })

  it('rejects bad studentCodes (non-array, too many, non-string members)', () => {
    expect(validatePushBody(ok({ studentCodes: 'nope' }))).toEqual({ ok: false, error: 'bad targets' })
    expect(validatePushBody(ok({ studentCodes: Array(1001).fill('x') }))).toEqual({ ok: false, error: 'bad targets' })
    expect(validatePushBody(ok({ studentCodes: ['ok', 5] }))).toEqual({ ok: false, error: 'bad targets' })
    expect(validatePushBody(ok({ studentCodes: Array(1000).fill('x') })).ok).toBe(true) // boundary
  })

  it('treats null/garbage input as an empty body (bad title)', () => {
    expect(validatePushBody(null)).toEqual({ ok: false, error: 'bad title' })
    expect(validatePushBody(undefined)).toEqual({ ok: false, error: 'bad title' })
  })
})

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks', () => {
    const t = 0
    const rl = createRateLimiter(3, 1000, () => t)
    expect(rl.limited('u1')).toBe(false) // 1
    expect(rl.limited('u1')).toBe(false) // 2
    expect(rl.limited('u1')).toBe(false) // 3
    expect(rl.limited('u1')).toBe(true)  // 4th within window → blocked
  })

  it('isolates callers by key', () => {
    const t = 0
    const rl = createRateLimiter(1, 1000, () => t)
    expect(rl.limited('a')).toBe(false)
    expect(rl.limited('a')).toBe(true)
    expect(rl.limited('b')).toBe(false) // b has its own budget
  })

  it('resets once the window elapses', () => {
    let t = 0
    const rl = createRateLimiter(1, 1000, () => t)
    expect(rl.limited('u1')).toBe(false)
    expect(rl.limited('u1')).toBe(true)
    t = 1001 // window passed
    expect(rl.limited('u1')).toBe(false)
  })

  // The memory cap used to clear the whole map, which handed an allowance back
  // to every caller in it at the exact moment the limiter was busiest. Trimming
  // now spares the callers close to their limit, so the one actually hammering
  // the endpoint stays counted while a flood of one-shot keys is evicted around
  // it — which is the only reason the map is being trimmed in the first place.
  it('does not forgive an active caller when the memory cap trips', () => {
    let t = 0
    const rl = createRateLimiter(3, 1000, () => t)
    expect(rl.limited('busy')).toBe(false)
    expect(rl.limited('busy')).toBe(false)
    expect(rl.limited('busy')).toBe(false)
    expect(rl.limited('busy')).toBe(true)
    // 1200 distinct callers with one request each, all inside the window, so
    // nothing is stale and the cap has to evict live entries to stay bounded.
    for (let i = 0; i < 1200; i++) rl.limited(`flood-${i}`)
    t = 1 // still inside 'busy''s window
    expect(rl.limited('busy')).toBe(true)
  })
})

// No Upstash env is set under test, so this exercises the in-memory fallback
// path of the distributed limiter. Keys are randomised so the module-level
// fallback limiter (shared per limit/window) can't leak counts between tests.
describe('rateLimit (in-memory fallback)', () => {
  it('allows up to the limit, then blocks', async () => {
    const key = `k-${Math.random()}`
    expect(await rateLimit(key, 2, 60_000)).toBe(false)
    expect(await rateLimit(key, 2, 60_000)).toBe(false)
    expect(await rateLimit(key, 2, 60_000)).toBe(true) // 3rd within window → blocked
  })

  it('isolates callers by key', async () => {
    const a = `a-${Math.random()}`, b = `b-${Math.random()}`
    expect(await rateLimit(a, 1, 30_000)).toBe(false)
    expect(await rateLimit(a, 1, 30_000)).toBe(true)
    expect(await rateLimit(b, 1, 30_000)).toBe(false) // b has its own budget
  })
})

// A parent's lock screen used to read "Marked absent today" with nothing to say
// who sent it. The centre name was in the payload but the service worker only
// reached for it when a push arrived with no title of its own — and every
// sender supplies a title, so it never once fired.
describe('signWithCentre', () => {
  it('puts the centre in the title and the message beneath it', () => {
    expect(signWithCentre('Sharma Classes', 'Marked absent today', 'Your ward was marked absent.'))
      .toEqual({ title: 'Sharma Classes', body: 'Marked absent today — Your ward was marked absent.' })
  })

  it('keeps the headline when there is no body to append', () => {
    expect(signWithCentre('Sharma Classes', 'Fees due', ''))
      .toEqual({ title: 'Sharma Classes', body: 'Fees due' })
  })

  it('leaves the notification alone when the centre has no name', () => {
    // Signing with the platform name instead would be worse than not signing:
    // the parent has never heard of Second Skool, they have heard of their
    // child's tuition centre.
    for (const name of [undefined, null, '', '   '])
      expect(signWithCentre(name, 'Fees due', 'Rs. 500 outstanding.'))
        .toEqual({ title: 'Fees due', body: 'Rs. 500 outstanding.' })
  })

  it('trims a padded centre name', () => {
    expect(signWithCentre('  Sharma Classes  ', 'Fees due', '').title).toBe('Sharma Classes')
  })

  it('never loses the headline the teacher wrote', () => {
    // Moving it into the body is the point; dropping it would not be.
    expect(signWithCentre('Sharma Classes', 'Test on Monday', 'Chapter 4 and 5.').body)
      .toContain('Test on Monday')
  })
})

describe('validateStudentRequest', () => {
  it('accepts a freshly minted student code', () => {
    const r = validateStudentRequest({ code: 'TUT-ABCDEFGH' })
    expect(r).toEqual({ ok: true, value: { code: 'TUT-ABCDEFGH' } })
  })

  it('normalises case and padding, because the code is a lookup key', () => {
    // The DB stores it upper-case; a lower-case send would silently find no
    // student and the head would never be told.
    const r = validateStudentRequest({ code: '  tut-abcdefgh  ' })
    expect(r.ok && r.value.code).toBe('TUT-ABCDEFGH')
  })

  it('rejects anything that is not a student code', () => {
    // This endpoint takes no bearer token — the code IS the authorisation, so
    // the shape gate has to stay narrow. A centre join code (6 chars, no
    // prefix) must not open it.
    for (const code of [undefined, null, 42, '', '7X2K9Q', 'TUT-', 'TUT-ABC', 'TUT-ABCDEFGHIJKLM',
      'TUT-ABCDEFG!', 'TUT-ABCDEFGH OR 1=1', { code: 'TUT-ABCDEFGH' }])
      expect(validateStudentRequest({ code }).ok).toBe(false)
  })

  it('rejects a missing body', () => {
    expect(validateStudentRequest(undefined).ok).toBe(false)
    expect(validateStudentRequest({}).ok).toBe(false)
  })
})
