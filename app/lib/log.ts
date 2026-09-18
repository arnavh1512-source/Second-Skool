// Minimal, dependency-free structured logger. Emits single-line JSON so Vercel
// log drains (Better Stack, Grafana Loki, Datadog, Sentry's Logs product, …)
// can parse it without pulling in a heavy SDK — which also avoids wiring an
// error-tracking SDK into this bleeding-edge Next build.
//
// PII-safe by construction: the `Fields` type only accepts scalars, so a caller
// can never dump a whole record (parent phone, address, tokens) into a log line
// by accident — you must pass explicit, named fields.
type Fields = Record<string, string | number | boolean | null>

// In the browser, console output dies with the tab, so errors are also posted
// to /api/log for the operator console. Capped per page load: a render loop
// that throws every frame should cost one burst, not a stream.
const REPORT_CAP = 10
let reported = 0

function report(event: string, fields: Fields): void {
  if (typeof window === 'undefined' || reported >= REPORT_CAP) return
  reported++
  // keepalive lets the report outlive a page that is closing because of the
  // crash. A failed report is dropped, never logged — logging it would report
  // it again.
  fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, fields }),
    keepalive: true,
  }).catch(() => {})
}

function emit(level: 'warn' | 'error', event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, ...fields, at: new Date().toISOString() })
  if (level === 'error') { console.error(line); report(event, fields) }
  else console.warn(line)
}

export const logWarn = (event: string, fields?: Fields): void => emit('warn', event, fields)
export const logError = (event: string, fields?: Fields): void => emit('error', event, fields)

type CrashReport = { event: string; detail: Fields }

const MAX_FIELDS = 12
const MAX_KEY = 40
const MAX_STRING = 300

/**
 * The server's view of a report: anyone can POST to /api/log, so the body is
 * rebuilt from scratch rather than trusted. The event must look like one of
 * ours; fields keep the logger's scalar-only shape, with keys and strings cut
 * to size and anything else dropped.
 */
export function validateCrashReport(raw: unknown): { ok: true; value: CrashReport } | { ok: false; error: string } {
  const body = raw as { event?: unknown; fields?: unknown } | null | undefined
  const event = body?.event
  if (typeof event !== 'string' || event.length > 80 || !/^[a-z0-9_.]+$/.test(event)) return { ok: false, error: 'bad event' }
  const fields = body?.fields
  const entries = fields && typeof fields === 'object' && !Array.isArray(fields) ? Object.entries(fields) : []
  const detail: Fields = {}
  for (const [k, v] of entries.slice(0, MAX_FIELDS)) {
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      detail[k.slice(0, MAX_KEY)] = typeof v === 'string' ? v.slice(0, MAX_STRING) : v
  }
  return { ok: true, value: { event, detail } }
}
