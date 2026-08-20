// The full-dataset fetch lives in SupabaseProvider (it owns the row mappers).
// It registers itself here so store actions can re-pull fresh data after a
// mutation (e.g. marking attendance) instead of waiting for a focus/refresh.
let _refresh: (() => Promise<void>) | null = null

export const registerRefresh = (fn: () => Promise<void>) => { _refresh = fn }

export const runRefresh = async () => { await _refresh?.() }
