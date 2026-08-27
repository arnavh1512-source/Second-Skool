import { supabase } from './supabase'

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)))
}

// Byte-compare a live subscription's server key against the one we'd use now.
function sameKey(existing: ArrayBuffer | null | undefined, current: Uint8Array): boolean {
  if (!existing) return false
  const a = new Uint8Array(existing)
  return a.length === current.length && a.every((b, i) => b === current[i])
}

// Ask permission, register the service worker, subscribe, and store it.
// kind='profile' → ref is the profile id (staff); kind='student' → ref is the code.
export async function enablePush(kind: 'profile' | 'student', ref: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Notifications aren’t supported on this device/browser' }
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, error: 'Notification permission was blocked' }
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const key = urlB64ToUint8Array(VAPID)

    // A subscription is permanently bound to the VAPID key it was created with.
    // Once the server keypair is rotated the old one still looks perfectly
    // healthy from here — getSubscription() returns it, the UI says
    // notifications are on — but every send is rejected 403 by the push
    // service. Reusing it blindly is how a device ends up silently
    // undeliverable, so drop any subscription signed by a different key.
    let sub = await reg.pushManager.getSubscription()
    if (sub && !sameKey(sub.options.applicationServerKey, key)) {
      try { await sub.unsubscribe() } catch { /* stale either way — resubscribe below */ }
      sub = null
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as unknown as BufferSource })
    const json = sub.toJSON()
    const { error } = await supabase.rpc('save_push_subscription', {
      p_endpoint: sub.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_kind: kind, p_ref: ref,
    })
    if (error) return { ok: false, error: 'Could not save subscription' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not enable notifications' }
  }
}

// Show a notification locally, through the service worker, with no server and
// no push service involved. This bisects the only two ways a reminder can fail:
// if the test pops up but a real reminder never does, delivery is broken; if
// neither pops up, it's the device's own notification settings and no amount of
// server work will fix it.
// `centreName` is passed in rather than read from the store because the store
// imports this module — the notification is signed with the centre's own name
// so a parent recognises who it is from, not the platform they've never heard of.
export async function testNotification(centreName?: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Notifications aren’t supported on this device/browser' }
  if (Notification.permission !== 'granted') return { ok: false, error: 'Turn on Alerts first' }
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(centreName?.trim() || 'Second Skool', {
      body: 'Test alert — reminders will look like this.',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      // Same options a real push uses, so the test proves the real thing.
      vibrate: [200, 100, 200],
      silent: false,
      timestamp: Date.now(),
      data: { url: '/' },
    } as NotificationOptions)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not show a notification' }
  }
}

// Fire a push send request to our API route. Returns how many devices were
// pushed (or a short error string) so the caller can surface a diagnostic.
export async function sendPush(payload: { studentCodes?: string[]; notifyHead?: boolean; title: string; body: string; url?: string }): Promise<{ sent?: number; undelivered?: number; error?: string }> {
  const post = (accessToken: string) => fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  })

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'not signed in' }

    // A token whose session row is gone still passes every RLS check —
    // PostgREST only verifies the signature — but GoTrue's /auth/v1/user,
    // which /api/push authenticates against, rejects it as session_not_found.
    // The app then works everywhere except push, indefinitely: getSession()
    // hands back the cached token without a network round trip, so nothing
    // ever notices. On a 401, refresh once (that mints a token bound to a
    // live session) and retry before blaming the user.
    let res = await post(session.access_token)
    if (res.status === 401) {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) return { error: 'session expired — sign out and sign in again' }
      res = await post(data.session.access_token)
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: json.error || `http ${res.status}` }
    return { sent: json.sent ?? 0, undelivered: json.undelivered ?? 0 }
  } catch {
    return { error: 'request failed' }
  }
}

// Tell the centre's head that a self-registered student is waiting for
// approval. Deliberately NOT sendPush: the student has no Supabase session, so
// sendPush bails at `not signed in` and the head is never told. The server
// authorises this one on the freshly minted student code instead — see
// /api/push/student-request. Best-effort: registration has already succeeded by
// the time this runs, so a failure here must never surface to the student.
export async function sendStudentRequestPush(code: string): Promise<void> {
  try {
    await fetch('/api/push/student-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  } catch {
    // no-op — the head still sees the request in the app
  }
}
