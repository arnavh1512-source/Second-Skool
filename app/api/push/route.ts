import { NextRequest, NextResponse } from 'next/server'
import { adminClient, adminConfigured, adminEnvShape } from '@/app/lib/supabase-admin'
import { safeLink, signWithCentre, validatePushBody, rateLimit } from '@/app/lib/push-guard'
import { deliver, headSubs, pushConfigured, type Sub } from '@/app/lib/push-send'
import { logError } from '@/app/lib/log'

export const runtime = 'nodejs'


// Per-caller rate limit: 30 sends/min. Shared across serverless instances when
// Upstash is configured; falls back to per-instance in-memory otherwise.
const RATE = { limit: 30, windowMs: 60_000 }

export async function POST(req: NextRequest) {
  if (!adminConfigured() || !pushConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  // Authenticate the caller (any signed-in user) and read their centre.
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    logError('push.unauthorized', { reason: 'no_token' })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const admin = adminClient()
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
      ...adminEnvShape(),
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
  const studentSubs: Sub[] = []

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
  const heads = notifyHead ? await headSubs(admin, centre) : []

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
  const { sent, undelivered } = await deliver(admin, [
    { subs: studentSubs, payload: JSON.stringify({ ...signWithCentre(centreName, title, text ?? ''), url: linkPath, centre: centreName }) },
    { subs: heads, payload: JSON.stringify({ title, body: text ?? '', url: linkPath, centre: centreName }) },
  ], centre)

  return NextResponse.json({ sent, ...(undelivered ? { undelivered } : {}) })
}
