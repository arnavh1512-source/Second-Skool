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

// What a teacher is told when a write reached Postgres and changed nothing.
// Deliberately actionable: the two real causes are a row that RLS will not let
// her touch and a row that no longer exists, and both are fixed by refreshing
// and looking again.
export const NOT_SAVED = 'Nothing was saved — refresh and try again. If it keeps happening, sign out and back in.'

// PostgREST answers an UPDATE that matched zero rows exactly like one that
// matched: no error, no complaint. So an update filtered out by RLS, or aimed
// at a row that is gone, looked like a success — the app set its local state,
// toasted "Saved", and navigated on while the database kept the old values.
// That is how a completed profile form could leave every column null.
//
// The fix is to ask for the affected ids back (.select('id')) and treat an
// empty array as the failure it is. Only for updates whose target row MUST
// exist — an update that legitimately matches nothing (say, marking due fees
// paid when none are due) must not use this.
export const changedNothing = (res: { data: unknown[] | null; error: unknown }) =>
  !res.error && !res.data?.length
