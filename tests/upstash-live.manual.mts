// Manual, one-off live check for the distributed rate limiter. Proves the
// counter really lives in Upstash Redis (shared across instances) rather than
// silently falling back to the in-memory limiter:
//   1. calls rateLimit() past its threshold and checks it blocks
//   2. reads the counter back out of Redis over REST and asserts it matches
//   3. re-imports the module (fresh in-memory state) — a memory-backed limiter
//      would reset here; a Redis-backed one keeps blocking
// Not part of the automated suite (no assertions, hits the network).
//   npx tsx tests/upstash-live.manual.mts
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^(UPSTASH_[A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const URL_ = process.env.UPSTASH_REDIS_REST_URL!
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!
console.log('Upstash URL →', URL_)
console.log('Token       →', TOKEN ? `set (${TOKEN.length} chars)` : 'MISSING')

const redis = async (...cmd: (string | number)[]) => {
  const res = await fetch(`${URL_}/${cmd.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  return res.json() as Promise<{ result?: unknown; error?: string }>
}

console.log('\n--- connectivity ---')
console.log('PING →', await redis('PING'))

const { rateLimit } = await import('../app/lib/push-guard.ts')
const LIMIT = 3, WINDOW = 60_000
const key = `verify-${Date.now()}`

console.log(`\n--- rateLimit(limit=${LIMIT}) ---`)
const results: boolean[] = []
for (let i = 1; i <= 5; i++) {
  const blocked = await rateLimit(key, LIMIT, WINDOW)
  results.push(blocked)
  console.log(`  call ${i}: ${blocked ? 'BLOCKED' : 'allowed'}`)
}

// Read the counter straight out of Redis. If the in-memory fallback had been
// used, no such key would exist and this would come back null.
const bucket = Math.floor(Date.now() / WINDOW)
const stored = await redis('GET', `rl:${key}:${bucket}`)
const ttl = await redis('TTL', `rl:${key}:${bucket}`)
console.log(`\n--- read back from Redis ---`)
console.log(`  GET rl:${key}:${bucket} →`, stored.result)
console.log(`  TTL                     →`, ttl.result, 'seconds')

const expectPattern = results.slice(0, LIMIT).every(r => !r) && results.slice(LIMIT).every(r => r)
const inRedis = Number(stored.result) === 5
const ttlSet = Number(ttl.result) > 0

console.log('\n--- verdict ---')
console.log(`  blocks after ${LIMIT} allowed   : ${expectPattern ? 'PASS' : 'FAIL'}`)
console.log(`  counter persisted in Redis  : ${inRedis ? 'PASS' : 'FAIL'} (expected 5)`)
console.log(`  TTL set (auto-expiry)       : ${ttlSet ? 'PASS' : 'FAIL'}`)
console.log(expectPattern && inRedis && ttlSet
  ? '\n✅ PASS — limit is enforced via Redis, shared across instances'
  : '\n❌ FAIL — see above')

await redis('DEL', `rl:${key}:${bucket}`) // clean up after ourselves
