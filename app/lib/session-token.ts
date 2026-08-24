// Is the access token we are holding still worth sending?
//
// supabase-js `getSession()` returns whatever is in storage without judging it,
// so an access token an hour past its expiry still satisfies a plain
// `if (session?.access_token)`. The server rejects it, the caller reports the
// session as dead, and the refresh token sitting right next to it is never
// tried. Ask about expires_at instead of about presence.
//
// Kept free of imports so it can be tested without a Supabase client.

/** Treat a token with less than this left as already gone: it can expire in
 *  flight otherwise, which reads to the user as a random logout. */
export const CLOCK_SKEW_S = 60

export type MaybeSession = { access_token?: string | null; expires_at?: number | null } | null | undefined

export function usableToken(session: MaybeSession, nowMs: number = Date.now()): string | null {
  const token = session?.access_token
  if (typeof token !== 'string' || token === '') return null

  // No expiry claim means we cannot prove it is stale. Send it and let the
  // server decide — refusing here would lock out a session that works.
  const exp = session?.expires_at
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return token

  return exp - CLOCK_SKEW_S > Math.floor(nowMs / 1000) ? token : null
}
