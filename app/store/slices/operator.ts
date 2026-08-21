import { supabase } from '../../lib/supabase'
import type { Slice } from '../slice'

// Raised when there is genuinely no usable session left. The console matches on
// this to offer a way back in, so keep the two in step.
export const SESSION_EXPIRED = 'Session expired — sign in again'

// getSession() hands back whatever is in storage without reaching for a new
// access token, so a tab left open past expiry saw "session expired" while a
// perfectly good refresh token sat unused beside it. Try the refresh before
// declaring the operator signed out.
export async function operatorToken(): Promise<string | null> {
  const { data: s } = await supabase.auth.getSession()
  if (s.session?.access_token) return s.session.access_token
  const { data: r } = await supabase.auth.refreshSession()
  return r.session?.access_token ?? null
}

// Operator-only writes. Throws with the server's own message so the console can
// show why something was refused instead of a generic failure.
async function devPost(body: Record<string, string>): Promise<void> {
  const token = await operatorToken()
  if (!token) throw new Error(SESSION_EXPIRED)
  const res = await fetch('/api/dev', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
}

type Keys =
  | 'checkDevAccess' | 'openDevConsole' | 'exitDevConsole'
  | 'devEnterCentre' | 'devLeaveCentre' | 'devDeleteCentre'

export const createOperatorSlice: Slice<Keys> = (set, get) => ({
  // Ask the server whether this account is the operator. The answer is a plain
  // boolean — the allowlist stays on the server, and a failed probe leaves the
  // console hidden rather than guessing.
  checkDevAccess: async () => {
    if (get().devAllowed !== null) return
    try {
      const token = await operatorToken()
      if (!token) { set({ devAllowed: false }); return }
      const res = await fetch('/api/dev?probe=1', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      const allowed = res.ok && json?.allowed === true
      set({ devAllowed: allowed, devSeat: allowed ? (json?.seat ?? null) : null })
    } catch { set({ devAllowed: false, devSeat: null }) }
  },

  openDevConsole: () => set({ devConsoleOpen: true }),
  exitDevConsole: () => set({ devConsoleOpen: false }),

  // Entering or leaving a centre rewrites the operator's role, centre and
  // approval status — the three things every screen, query and RLS policy is
  // keyed on. A full reload is the only way to guarantee no slice of state is
  // left describing the previous seat.
  devEnterCentre: async (centreId: string) => {
    await devPost({ action: 'enter', centreId })
    window.location.reload()
  },

  devLeaveCentre: async () => {
    await devPost({ action: 'leave' })
    window.location.reload()
  },

  // Deleting the centre you are sitting inside also releases the seat, which
  // means this session's role and centre are now wrong — reload. Deleting any
  // other centre changes nothing about who you are, so the console just
  // refreshes its list and stays open.
  devDeleteCentre: async (centreId: string, confirm: string) => {
    await devPost({ action: 'delete', centreId, confirm })
    if (get().devSeat?.centreId === centreId) window.location.reload()
  },
})
