import { logError } from '../lib/log'

// Surfaces a toast AND records why. Postgres tells us exactly what it rejected
// (constraint violation, RLS denial, missing column); throwing that away turned
// a one-line schema bug into a debugging session, so keep the code + message.
export const dbErr = (op: string, notify: (m: string) => void) =>
  ({ error }: { error: unknown }) => {
    if (!error) return
    const e = error as { code?: string; message?: string; details?: string }
    logError('db.sync_failed', {
      op,
      code: e.code ?? null,
      message: e.message ?? String(error),
      details: e.details ?? null,
    })
    notify(`Sync failed: ${op}`)
  }
