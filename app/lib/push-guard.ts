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
  // Each code is checked too, not just the array length. Student codes are
  // short and fixed-shape, so 1000 unbounded strings was a megabytes-per-request
  // hole in an otherwise capped body.
  if (studentCodes !== undefined && (!Array.isArray(studentCodes) || studentCodes.length > 1000
    || studentCodes.some(c => typeof c !== 'string' || c.length === 0 || c.length > 32)))
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
