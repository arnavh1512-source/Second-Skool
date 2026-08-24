import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { safeLink, signWithCentre, validatePushBody, rateLimit } from '@/app/lib/push-guard'
import { logError } from '@/app/lib/log'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
// `||` not `??` on purpose: an env var set to an empty string in the Vercel UI
// is '' rather than undefined, and setVapidDetails throws on a blank subject —
// which would take the whole route down at module load with an opaque 500.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@secondskool.app'

if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

type Row = { endpoint: string; p256dh: string; auth: string }

// Per-caller rate limit: 30 sends/min. Shared across serverless instances when
// Upstash is configured; falls back to per-instance in-memory otherwise.
const RATE = { limit: 30, windowMs: 60_000 }

export async function POST(req: NextRequest) {
  if (!url || !serviceKey || !VAPID_PRIVATE) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  // Authenticate the caller (any signed-in user) and read their centre.
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    logError('push.unauthorized', { reason: 'no_token' })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: authErr } = await admin.auth.getUser(token)
  const uid = userData.user?.id
  if (!uid) {
    // A token was sent but Supabase refused it. Log why — an expired session
    // and a service key pointing at the wrong project both surface as a bare
    // 401 otherwise, and they need completely different fixes.
    logError('push.unauthorized', {
      reason: 'token_rejected',
      authError: authErr?.message ?? null,
      status: authErr?.status ?? null,
      // Which project the server thinks it's talking to — a mismatch against
      // the client's project is the usual cause. Host only, never the key.
      supabaseHost: (() => { try { return new URL(url).host } catch { return null } })(),
      // Shape checks for the two env vars involved. Lengths and prefixes only —
      // never the values. A quoted or newline-padded paste in the Vercel UI is
      // the usual culprit and is invisible in every other symptom.
      urlLen: url.length,
      urlClean: url === url.trim() && url.startsWith('https://'),
      keyLen: serviceKey.length,
      keyClean: serviceKey === serviceKey.trim() && serviceKey.startsWith('eyJ'),
      tokenLen: token.length,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (await rateLimit(uid, RATE.limit, RATE.windowMs)) return NextResponse.json({ error: 'too many requests — slow down' }, { status: 429 })
  const { data: me } = await admin.from('profiles').select('centre_id, staff_status').eq('id', uid).single()
  const centre = me?.centre_id
  if (!centre) return NextResponse.json({ error: 'no centre' }, { status: 403 })

  const parsed = validatePushBody(await req.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { studentCodes, notifyHead, title, body: text, url: link } = parsed.value

  // Kept apart because they are signed differently: a parent needs to be told
  // which centre is messaging them, the head already knows — it is theirs.
  const studentSubs: Row[] = []
  const headSubs: Row[] = []

  // Student targets — approved staff only (pending teachers may only notifyHead),
  // and only students in the caller's centre.
  if (studentCodes?.length) {
    if (me?.staff_status !== 'approved') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data: students } = await admin.from('students').select('student_code').eq('centre_id', centre).in('student_code', studentCodes)
    const allowed = (students ?? []).map(s => s.student_code)
    if (allowed.length) {
      const { data } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('kind', 'student').in('ref', allowed)
      studentSubs.push(...(data ?? []))
    }
  }

  // Notify the centre's head (used when a teacher requests to join).
  if (notifyHead) {
    const { data: heads } = await admin.from('profiles').select('id').eq('centre_id', centre).eq('role', 'admin').eq('staff_status', 'approved')
    const ids = (heads ?? []).map(h => h.id)
    if (ids.length) {
      const { data } = await admin.from('push_subscriptions').select('endpoint,p256dh,auth').eq('kind', 'profile').in('ref', ids)
      headSubs.push(...(data ?? []))
    }
  }

  // The centre's name, read server-side so a caller can never sign a
  // notification as somebody else's centre.
  const { data: centreRow } = await admin.from('centres').select('name').eq('id', centre).single()
  const centreName = centreRow?.name ?? ''

  // Only same-app relative paths in notification links (see push-guard).
  const linkPath = safeLink(link)
  // Two audiences, signed differently. A parent sees the centre's name as the
  // title and the message beneath it (see signWithCentre) — an alert about
  // their child with no sender attached reads like spam and gets swiped away.
  // The head sees the message as written: it is their own centre, and stamping
  // their own name on a join request they are waiting for is just noise.
  const groups: Array<{ subs: Row[]; payload: string }> = [
    { subs: studentSubs, payload: JSON.stringify({ ...signWithCentre(centreName, title, text ?? ''), url: linkPath, centre: centreName }) },
    { subs: headSubs, payload: JSON.stringify({ title, body: text ?? '', url: linkPath, centre: centreName }) },
  ].filter(g => g.subs.length > 0)

  // Fan out in bounded batches (100) so a large centre can't stall the request
  // or flood the push service at once. 404/410 = expired subscription → prune;
  // any other failure is logged (id + status only, no PII) so it's visible in
  // Vercel logs instead of vanishing silently.
  const stale: string[] = []
  let failed = 0
  const BATCH = 100
  for (const { subs, payload } of groups) {
    for (let i = 0; i < subs.length; i += BATCH) {
      await Promise.all(subs.slice(i, i + BATCH).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode
          // 404/410 = subscription retired by the push service.
          // 403 = the VAPID key that signed this send isn't the one the
          // subscription was created with (i.e. the server keypair was rotated).
          // Either way it can never be delivered to again, so prune it — leaving
          // it behind means every future send reports a device that cannot
          // receive anything.
          if (code === 404 || code === 410 || code === 403) stale.push(s.endpoint)
          else failed++
          if (code !== 404 && code !== 410) logError('push.send_failed', { centre, statusCode: code ?? null })
        }
      }))
    }
  }
  if (stale.length) await admin.from('push_subscriptions').delete().in('endpoint', stale)

  // Count deliveries, not attempts. Reporting subs.length here meant a send
  // that was rejected by every push service still told the teacher "pushed to
  // 1 device" — the most misleading possible answer, because it points the
  // investigation at the phone instead of at the server.
  const sent = studentSubs.length + headSubs.length - stale.length - failed
  return NextResponse.json({ sent, ...(stale.length || failed ? { undelivered: stale.length + failed } : {}) })
}
