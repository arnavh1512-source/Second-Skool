// Minimal, dependency-free structured logger. Emits single-line JSON so Vercel
// log drains (Better Stack, Grafana Loki, Datadog, Sentry's Logs product, …)
// can parse it without pulling in a heavy SDK — which also avoids wiring an
// error-tracking SDK into this bleeding-edge Next build.
//
// PII-safe by construction: the `Fields` type only accepts scalars, so a caller
// can never dump a whole record (parent phone, address, tokens) into a log line
// by accident — you must pass explicit, named fields.
type Fields = Record<string, string | number | boolean | null>

function emit(level: 'warn' | 'error', event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, ...fields, at: new Date().toISOString() })
  if (level === 'error') console.error(line)
  else console.warn(line)
  if (level === 'error') forwardToSentry(event, fields) // fire-and-forget, best-effort
}

export const logWarn = (event: string, fields?: Fields): void => emit('warn', event, fields)
export const logError = (event: string, fields?: Fields): void => emit('error', event, fields)

// ---------------------------------------------------------------------------
// Sentry forwarding (closes audit M5). Dormant with zero cost until SENTRY_DSN
// is set; then every logError is also delivered to Sentry as an event via the
// raw envelope endpoint — no SDK, so nothing to break on this bleeding-edge
// Next build, and no extra bytes in the client bundle (this module is server-
// side only). Only `error` level is forwarded; info/warn stay in the log drain.
// ---------------------------------------------------------------------------
type SentryTarget = { endpoint: string; key: string }

// DSN shape: https://<publicKey>@<host>/<projectId>
export function parseSentryDsn(dsn: string | undefined): SentryTarget | null {
  if (!dsn) return null
  try {
    const u = new URL(dsn)
    const projectId = u.pathname.replace(/^\//, '')
    if (!u.username || !projectId) return null
    return { endpoint: `${u.protocol}//${u.host}/api/${projectId}/envelope/`, key: u.username }
  } catch {
    return null
  }
}

const sentry = parseSentryDsn(process.env.SENTRY_DSN)

function forwardToSentry(event: string, fields: Fields): void {
  if (!sentry) return
  try {
    const eventId = crypto.randomUUID().replace(/-/g, '')
    const header = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })
    // Sentry expects a LogEntry object here, not a bare string — a plain
    // `message` renders as "(No error message)" in the issue feed. `formatted`
    // is what's shown, so fold the fields in to make the issue readable at a
    // glance without opening it; `extra` keeps them queryable.
    const detail = Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(' ')
    const envelope = JSON.stringify({
      event_id: eventId,
      level: 'error',
      message: { formatted: detail ? `${event} — ${detail}` : event },
      logger: 'app',
      platform: 'javascript',
      timestamp: Date.now() / 1000,
      environment: process.env.VERCEL_ENV ?? 'development',
      // Group by event name so repeats of the same failure collapse into one
      // issue instead of flooding the feed with N identical entries.
      fingerprint: [event],
      tags: { event },
      extra: fields,
    })
    void fetch(`${sentry.endpoint}?sentry_key=${sentry.key}&sentry_version=7`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      body: `${header}\n${JSON.stringify({ type: 'event' })}\n${envelope}`,
      signal: AbortSignal.timeout(2000),
    }).catch(() => {}) // never let telemetry failure surface to the caller
  } catch {
    // crypto/env issues must never break logging
  }
}
