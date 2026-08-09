import { describe, it, expect } from 'vitest'
import { safeLink, validatePushBody, createRateLimiter, rateLimit } from '../app/lib/push-guard'

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
    let t = 0
    const rl = createRateLimiter(3, 1000, () => t)
    expect(rl.limited('u1')).toBe(false) // 1
    expect(rl.limited('u1')).toBe(false) // 2
    expect(rl.limited('u1')).toBe(false) // 3
    expect(rl.limited('u1')).toBe(true)  // 4th within window → blocked
  })

  it('isolates callers by key', () => {
    let t = 0
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
