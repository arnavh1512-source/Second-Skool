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
}

export const logWarn = (event: string, fields?: Fields): void => emit('warn', event, fields)
export const logError = (event: string, fields?: Fields): void => emit('error', event, fields)
