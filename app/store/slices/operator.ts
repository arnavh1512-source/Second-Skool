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
  | 'checkDevAccess' | 'openDevConsole' | 'exitDevConsole' | 'devDeleteCentre'
  | 'devReplyTicket' | 'devResolveTicket'

export const createOperatorSlice: Slice<Keys> = (set, get) => ({
  // Ask the server whether this account is the operator. The answer is a plain
  // boolean — the allowlist stays on the server, and a failed probe leaves the
  // console hidden rather than guessing.
  checkDevAccess: async () => {
    if (get().devAllowed !== null) return
    try {
      const json = await devFetch<{ allowed?: boolean }>('/api/dev?probe=1')
      set({ devAllowed: json?.allowed === true })
    } catch { set({ devAllowed: false }) }
  },

  openDevConsole: () => set({ devConsoleOpen: true }),
  exitDevConsole: () => set({ devConsoleOpen: false }),

  // The operator belongs to no centre, so deleting one never changes who this
  // session is — the console just refreshes its list and stays open.
  devDeleteCentre: async (centreId: string, confirm: string) => {
    await devPost({ action: 'delete', centreId, confirm })
  },

  devReplyTicket: async (ticketId: string, message: string) => {
    await devPost({ action: 'ticketReply', ticketId, message })
  },

  devResolveTicket: async (ticketId: string) => {
    await devPost({ action: 'ticketResolve', ticketId })
  },
})
