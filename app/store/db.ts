import { logError } from '../lib/log'
import { friendlyError } from './errors'
import type { ToastKind } from './types'

// Surfaces a toast AND records why. Postgres tells us exactly what it rejected
// (constraint violation, RLS denial, missing column); throwing that away turned
// a one-line schema bug into a debugging session, so keep the code + message in
// the log. What the *user* sees is a translation — "Sync failed: save
// attendance" told a teacher neither what broke nor what to do about it, and
// "sync" is not a word she uses.
export const dbErr = (op: string, notify: (m: string, kind?: ToastKind) => void) =>
  ({ error }: { error: unknown }) => {
    if (!error) return
    const e = error as { code?: string; message?: string; details?: string }
    logError('db.sync_failed', {
      op,
      code: e.code ?? null,
      message: e.message ?? String(error),
      details: e.details ?? null,
    })
    notify(friendlyError(error, op), 'error')
  }
