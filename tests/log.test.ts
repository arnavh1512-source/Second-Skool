import { describe, it, expect, vi, afterEach } from 'vitest'
import { logInfo, logWarn, logError, parseSentryDsn } from '../app/lib/log'

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

  it('logWarn → console.warn, logInfo → console.log, at the right level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    logWarn('x.warned')
    logInfo('x.happened', { n: 1 })
    expect(parseLast(warn).level).toBe('warn')
    expect(parseLast(log)).toMatchObject({ level: 'info', event: 'x.happened', n: 1 })
  })

  it('emits valid single-line JSON with no fields', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logError('bare.event')
    const raw = spy.mock.calls.at(-1)?.[0] as string
    expect(raw).not.toContain('\n')
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})

describe('parseSentryDsn', () => {
  it('parses a valid DSN into an envelope endpoint + public key', () => {
    expect(parseSentryDsn('https://abc123@o1.ingest.sentry.io/456')).toEqual({
      endpoint: 'https://o1.ingest.sentry.io/api/456/envelope/',
      key: 'abc123',
    })
  })

  it('returns null for missing, empty, or malformed DSNs', () => {
    expect(parseSentryDsn(undefined)).toBeNull()
    expect(parseSentryDsn('')).toBeNull()
    expect(parseSentryDsn('not a url')).toBeNull()
    expect(parseSentryDsn('https://o1.ingest.sentry.io/456')).toBeNull() // no public key
    expect(parseSentryDsn('https://abc@o1.ingest.sentry.io/')).toBeNull() // no project id
  })
})
