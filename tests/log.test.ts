import { describe, it, expect, vi, afterEach } from 'vitest'
import { logWarn, logError, validateCrashReport } from '../app/lib/log'

afterEach(() => vi.restoreAllMocks())

const parseLast = (spy: ReturnType<typeof vi.spyOn>) =>
  JSON.parse((spy.mock.calls.at(-1)?.[0] as string))

describe('structured logger', () => {
  it('logError writes one JSON line to console.error with level/event/fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('push.send_failed', { centre: 'c1', statusCode: 500 })
    expect(spy).toHaveBeenCalledOnce()
    const rec = parseLast(spy)
    expect(rec).toMatchObject({ level: 'error', event: 'push.send_failed', centre: 'c1', statusCode: 500 })
    expect(typeof rec.at).toBe('string') // ISO timestamp present
  })

  it('logWarn → console.warn, at the right level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logWarn('x.warned', { n: 1 })
    expect(parseLast(warn)).toMatchObject({ level: 'warn', event: 'x.warned', n: 1 })
  })

  it('emits valid single-line JSON with no fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('bare.event')
    const raw = spy.mock.calls.at(-1)?.[0] as string
    expect(raw).not.toContain('\n')
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe('validateCrashReport', () => {
  it('keeps a well-formed report as sent', () => {
    expect(validateCrashReport({ event: 'client.render_crash', fields: { message: 'x', n: 2, ok: false, gone: null } }))
      .toEqual({ ok: true, value: { event: 'client.render_crash', detail: { message: 'x', n: 2, ok: false, gone: null } } })
  })

  it('refuses an event that is not one of ours', () => {
    for (const event of [undefined, 42, '', 'Has Spaces', '<script>', 'a'.repeat(81)])
      expect(validateCrashReport({ event }).ok).toBe(false)
    expect(validateCrashReport(null).ok).toBe(false)
  })

  it('drops non-scalar fields and cuts everything to size', () => {
    const fields: Record<string, unknown> = { nested: { phone: '98…' }, list: [1], ['k'.repeat(60)]: 's'.repeat(500) }
    for (let i = 0; i < 20; i++) fields[`f${i}`] = i
    const r = validateCrashReport({ event: 'x.y', fields })
    if (!r.ok) throw new Error('expected ok')
    expect(r.value.detail).not.toHaveProperty('nested')
    expect(r.value.detail).not.toHaveProperty('list')
    expect(r.value.detail['k'.repeat(40)]).toHaveLength(300)
    expect(Object.keys(r.value.detail).length).toBeLessThanOrEqual(12)
  })

  it('treats a non-object fields value as no fields', () => {
    expect(validateCrashReport({ event: 'x.y', fields: 'boom' })).toEqual({ ok: true, value: { event: 'x.y', detail: {} } })
  })
})
