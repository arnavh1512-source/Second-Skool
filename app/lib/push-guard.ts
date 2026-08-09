// Pure, dependency-free guards for the /api/push endpoint. Extracted from the
// route so the security-critical logic (link safety, input validation, rate
// limiting) can be unit-tested without spinning up a server or Supabase.

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
  if (studentCodes !== undefined && (!Array.isArray(studentCodes) || studentCodes.length > 1000 || studentCodes.some(c => typeof c !== 'string')))
    return { ok: false, error: 'bad targets' }
  return { ok: true, value: b as PushBody }
}

// Sliding-window rate limiter keyed by caller id. Pure given an injected clock,
// so window expiry is testable. Best-effort per serverless instance (see the
// audit's M3): the counter isn't shared across instances.
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const log = new Map<string, number[]>()
  return {
    limited(key: string): boolean {
      const t = now()
      const recent = (log.get(key) ?? []).filter(ts => t - ts < windowMs)
      if (recent.length >= limit) { log.set(key, recent); return true }
      recent.push(t)
      log.set(key, recent)
      if (log.size > 1000) log.clear() // cap memory on long-lived instances
      return false
    },
  }
}

// ---------------------------------------------------------------------------
// Distributed rate limit (closes audit M2/M3: the per-instance limiter above
// doesn't hold across Vercel's multiple serverless instances). When Upstash
// Redis REST creds are present, the counter is shared across every instance via
// a fixed-window INCR; otherwise it transparently falls back to the in-memory
// limiter — so the app is correct with or without Upstash, and gets the real
// cross-instance guarantee the moment the two env vars are set (zero code
// change, zero cost until then).
// ---------------------------------------------------------------------------
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// One in-memory fallback limiter per (limit,window) so repeated calls with the
// same config share a window instead of resetting each time.
const memLimiters = new Map<string, ReturnType<typeof createRateLimiter>>()
function memLimited(key: string, limit: number, windowMs: number): boolean {
  const id = `${limit}:${windowMs}`
  let l = memLimiters.get(id)
  if (!l) { l = createRateLimiter(limit, windowMs); memLimiters.set(id, l) }
  return l.limited(key)
}

// Returns true if `key` has exceeded `limit` requests in the current window.
// Never throws: any Upstash error/timeout degrades to the in-memory limiter so
// a Redis blip can never take the endpoint down.
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const bucket = Math.floor(Date.now() / windowMs)        // fixed window id
      const redisKey = `rl:${key}:${bucket}`
      const ttl = Math.ceil(windowMs / 1000)
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([['INCR', redisKey], ['EXPIRE', redisKey, ttl]]),
        signal: AbortSignal.timeout(1500),
      })
      if (res.ok) {
        const data = await res.json() as Array<{ result?: number }>
        return Number(data?.[0]?.result ?? 0) > limit
      }
    } catch {
      // fall through to the in-memory limiter
    }
  }
  return memLimited(key, limit, windowMs)
}
