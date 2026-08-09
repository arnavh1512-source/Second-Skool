// Manual, one-off live check: fires a real error through app/lib/log.ts's
// Sentry forwarder using the DSN from .env.local, and reports the HTTP result.
// Not part of the automated suite (no assertions, hits the network).
//   npx tsx tests/sentry-live.manual.ts
import { readFileSync } from 'node:fs'

const dsn = readFileSync('.env.local', 'utf8')
  .split('\n').find(l => l.startsWith('SENTRY_DSN='))?.slice('SENTRY_DSN='.length).trim()
process.env.SENTRY_DSN = dsn
process.env.VERCEL_ENV = 'local-verification'

const { parseSentryDsn, logError } = await import('../app/lib/log.ts')

const target = parseSentryDsn(dsn)
console.log('DSN parsed →', target)
if (!target) { console.error('FAIL: DSN did not parse'); process.exit(1) }

// Intercept fetch to surface the status the fire-and-forget forwarder swallows.
const realFetch = globalThis.fetch
let status = 0, bodyText = ''
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const res = await realFetch(...args)
  status = res.status
  bodyText = await res.clone().text()
  return res
}

logError('verification.test_error', { source: 'manual-check', centre: 'none' })

await new Promise(r => setTimeout(r, 4000))
console.log('Sentry HTTP status →', status)
console.log('Sentry response    →', bodyText)
console.log(status === 200 ? '\n✅ PASS — event accepted by Sentry' : '\n❌ FAIL — see status above')
