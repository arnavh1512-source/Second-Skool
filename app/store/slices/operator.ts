import { supabase } from '../../lib/supabase'
import { usableToken } from '../../lib/session-token'
import type { Slice } from '../slice'

// Raised when there is genuinely no usable session left. The console matches on
// this to offer a way back in, so keep the two in step.
export const SESSION_EXPIRED = 'Session expired — sign in again'

// One refresh at a time, shared by every caller that asks while it is running.
// Supabase rotates the refresh token on use, so two concurrent refreshes mean
// the second presents a token the first already spent: it fails, returns null,
// and the console announces "session expired" on a session that is fine. The
// console mount and checkDevAccess both ask at once, so this was reachable on
// an ordinary page load.
let refreshing: Promise<string | null> | null = null

function refreshOnce(): Promise<string | null> {
  refreshing ??= supabase.auth.refreshSession()
    .then(({ data }) => data.session?.access_token ?? null)
    .catch(() => null)
    .finally(() => { refreshing = null })
  return refreshing
}

export async function operatorToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return usableToken(data.session) ?? await refreshOnce()
}

// Every call to /api/dev goes through here. A 401 gets one forced refresh and a
// single retry: the token can expire between the check above and the server
// reading it, and losing the console to that is not something to leave to luck.
// Only a 401 that survives the retry is really a dead session.
export async function devFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const send = (token: string) =>
    fetch(url, { ...init, cache: 'no-store', headers: { ...init?.headers, authorization: `Bearer ${token}` } })

  const first = await operatorToken()
  if (!first) throw new Error(SESSION_EXPIRED)

  let res = await send(first)
  if (res.status === 401) {
    const second = await refreshOnce()
    if (!second) throw new Error(SESSION_EXPIRED)
    res = await send(second)
    if (res.status === 401) throw new Error(SESSION_EXPIRED)
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json as T
}

// Operator-only writes. Throws with the server's own message so the console can
// show why something was refused instead of a generic failure.
async function devPost(body: Record<string, string>): Promise<void> {
  await devFetch('/api/dev', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
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
      const json = await devFetch<{ allowed?: boolean; seat?: { centreId: string; centreName: string } | null }>('/api/dev?probe=1')
      const allowed = json?.allowed === true
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
