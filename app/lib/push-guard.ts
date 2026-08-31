// Pure, dependency-free guards for the /api/push endpoint. Extracted from the
// route so the security-critical logic (link safety, input validation, rate
// limiting) can be unit-tested without spinning up a server or Supabase.

import { logWarn } from './log'

export type PushBody = {
  studentCodes?: string[]
  notifyHead?: boolean
  title: string
  body?: string
  url?: string
}

// Notification links may only be same-app relative paths. Absolute URLs
// (`http://evil.com`), protocol-relative (`//evil.com`) and scheme links
// (`javascript:…`) are rejected so a tapped notification can never redirect the
// user off-app. Anything invalid falls back to the app root.
export function safeLink(link: unknown): string {
  return typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : '/'
}

export type Validated = { ok: true; value: PushBody } | { ok: false; error: string }

// Validates the request body. Title is required (1–120 chars); body optional
// (≤500); studentCodes optional (array of ≤1000 strings). Mirrors the caps the
// DB and payload size assume, so a malformed/oversized request is refused at the
// edge instead of fanning out.
export function validatePushBody(raw: unknown): Validated {
  const b = (raw ?? {}) as Record<string, unknown>
  const { title, body, studentCodes } = b
  if (typeof title !== 'string' || title.length === 0 || title.length > 120) return { ok: false, error: 'bad title' }
  if (body !== undefined && (typeof body !== 'string' || body.length > 500)) return { ok: false, error: 'bad body' }
  // Each code is checked too, not just the array length. Student codes are
  // short and fixed-shape, so 1000 unbounded strings was a megabytes-per-request
  // hole in an otherwise capped body.
  if (studentCodes !== undefined && (!Array.isArray(studentCodes) || studentCodes.length > 1000
    || studentCodes.some(c => typeof c !== 'string' || c.length === 0 || c.length > 32)))
    return { ok: false, error: 'bad targets' }
  return { ok: true, value: b as PushBody }
}

// Sliding-window rate limiter keyed by caller id. Pure given an injected clock,
// so window expiry is testable. This one counts within a single serverless
// instance; rateLimit() below is what routes call, and it prefers a shared
// counter when one is configured.
const CAP = 1000

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const log = new Map<string, number[]>()
  return {
    limited(key: string): boolean {
      const t = now()
      const recent = (log.get(key) ?? []).filter(ts => t - ts < windowMs)
      const over = recent.length >= limit
      if (!over) recent.push(t)
      // Deleting before setting rather than overwriting in place: a Map keeps
      // insertion order, and re-inserting is what makes that order mean "least
      // recently seen first", which is what the eviction below needs.
      log.delete(key)
      log.set(key, recent)
      // Cap memory on long-lived instances. Dropping the whole map would have
      // handed every caller in it a fresh allowance — the one moment the
      // limiter is under load is the one moment it forgot everything. Evict
      // only the keys whose newest request is already outside the window, which
      // are the entries `limited()` would have discarded anyway.
      if (log.size > CAP) {
        for (const [k, stamps] of log) if (stamps[stamps.length - 1] <= t - windowMs) log.delete(k)
        // A flood of distinct keys inside one window leaves nothing stale to
        // sweep, and a map that only ever grows is a memory leak on an instance
        // the platform keeps alive for hours — which is the shape of the attack
        // this guard exists to survive. So something has to go, and the only
        // question is what.
        //
        // Not the callers close to their limit: forgetting those is forgetting
        // the enforcement itself, at the exact moment it is doing work. The
        // entries worth least are the ones a long way from tripping, taken
        // least recently seen first, which map order gives for free.
        for (const [k, stamps] of log) {
          if (log.size <= CAP) break
          if (stamps.length < limit) log.delete(k)
        }
        // Every entry is at its limit and the map is still too big: the flood is
        // now entirely made of blocked callers, and a bounded map matters more
        // than any one of them staying counted. They are re-counted on their
        // very next request anyway.
        while (log.size > CAP) {
          const oldest = log.keys().next().value
          if (oldest === undefined) break
          log.delete(oldest)
        }
      }
      return over
    },
  }
}

// One limiter per (limit,window) so repeated calls with the same config share a
// window instead of resetting each time. `async` because the shared counter
// below is a network call.
const limiters = new Map<string, ReturnType<typeof createRateLimiter>>()

// ---------------------------------------------------------------------------
// The shared counter.
//
// Vercel's Fluid Compute reuses a function instance across concurrent requests,
// but it still runs several instances at once and they share no memory. A limit
// held in a Map is therefore a limit per instance: the real ceiling is the one
// above multiplied by however many instances the platform happened to start,
// and the caller does not have to know that to benefit from it.
//
// So when an Upstash Redis REST endpoint is configured, the count lives there
// instead. Plain fetch against their HTTP API — the official client is a
// dependency for a two-command pipeline.
//
// The key carries the window number, so each window is a fresh key that expires
// on its own. The alternative — one key with its TTL refreshed on every hit —
// never expires under sustained traffic, which locks out the steady caller it
// was meant to allow.
//
// Any failure returns null and the caller falls back to memory. A rate limiter
// that cannot reach its counter must not fail closed (the endpoint goes dark
// over an unrelated outage) nor fully open (the guard silently stops existing).
// Per-instance counting is the honest middle: worse than shared, better than
// none, and exactly what this app did before.
//
// It is also invisible, which was the real problem: an Upstash outage silently
// multiplied every limit by the instance count and nothing anywhere said so.
// The fallback now leaves a line in the log, so "the push limits were softer
// than they look" is something you can find out afterwards rather than guess.
// ---------------------------------------------------------------------------

// Throttle the warning itself. The endpoint this guards can be hit hundreds of
// times a minute, and a counter outage would put one line in the log for each.
let lastFallbackLog = 0
const FALLBACK_LOG_EVERY_MS = 60_000

function fellBack(reason: string): null {
  const now = Date.now()
  if (now - lastFallbackLog >= FALLBACK_LOG_EVERY_MS) {
    lastFallbackLog = now
    logWarn('push.ratelimit_fallback', { reason })
  }
  return null
}

async function sharedCount(key: string, windowMs: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  // Not configured is a deployment choice, not a fault — nothing to report.
  if (!url || !token) return null
  const bucket = `rl:${key}:${Math.floor(Date.now() / windowMs)}`
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify([['INCR', bucket], ['PEXPIRE', bucket, String(windowMs * 2)]]),
      cache: 'no-store',
      // A rate limiter is in front of the work, not instead of it. One second
      // is already longer than the request it is guarding deserves to wait.
      signal: AbortSignal.timeout(1000),
    })
    if (!res.ok) return fellBack(`http ${res.status}`)
    const out = await res.json()
    const n = Array.isArray(out) ? out[0]?.result : null
    return typeof n === 'number' ? n : fellBack('unreadable response')
  } catch (e) {
    return fellBack(e instanceof Error ? e.name : 'unreachable')
  }
}

// Returns true if `key` has exceeded `limit` requests in the current window.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const shared = await sharedCount(key, windowMs)
  if (shared !== null) return shared > limit
  const id = `${limit}:${windowMs}`
  let l = limiters.get(id)
  if (!l) { l = createRateLimiter(limit, windowMs); limiters.set(id, l) }
  return l.limited(key)
}

// ---------------------------------------------------------------------------
// Signing a notification with the centre it came from.
//
// The centre's name was already being sent in the payload, but the service
// worker only reached for it when a push arrived with no title of its own —
// and every sender supplies a title. So in practice a parent's lock screen read
// "Marked absent today" with nothing to say who sent it: not the centre, not
// even a name they recognise. For a parent with children at two centres it was
// ambiguous, and for everyone else an unattributed alert about their child
// reads like spam and gets swiped away.
//
// Messaging apps solved this long ago: the title is WHO it is from, the body is
// WHAT they said. So the centre's name becomes the title and the original title
// leads the body. "Sharma Classes / Marked absent today — Your ward was..."
//
// Composed on the server, not in the service worker, for two reasons: the
// server is the only side that knows the centre name is genuine (it reads it
// from the DB, so a caller can't sign as somebody else's centre), and a device
// running a stale service worker gets the fix immediately instead of on its
// next update.
export function signWithCentre(centreName: string | null | undefined, title: string, body: string): { title: string; body: string } {
  const centre = (centreName ?? '').trim()
  // No centre name on record — leave the notification exactly as it was rather
  // than signing it with the platform name, which the parent has never heard of.
  if (!centre) return { title, body }
  return { title: centre, body: body ? `${title} — ${body}` : title }
}

// ---------------------------------------------------------------------------
// The unauthenticated student-request sender (/api/push/student-request).
//
// A self-registering student has no Supabase session — that is the whole point
// of the code-access flow — so this one sender cannot present a bearer token.
// The freshly minted student code stands in for the token: the caller can only
// know it by having just completed the registration, and the server re-reads
// the row it names and refuses anything that is not still pending. This guard
// is only the cheap shape gate in front of that lookup.
// ---------------------------------------------------------------------------
export type StudentRequestBody = { code: string }

export function validateStudentRequest(raw: unknown): { ok: true; value: StudentRequestBody } | { ok: false; error: string } {
  const code = (raw as Record<string, unknown> | null | undefined)?.code
  if (typeof code !== 'string' || !/^TUT-[A-Z0-9]{4,12}$/.test(code.trim().toUpperCase())) return { ok: false, error: 'bad code' }
  return { ok: true, value: { code: code.trim().toUpperCase() } }
}
