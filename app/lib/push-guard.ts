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
