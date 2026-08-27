import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, validateStudentRequest } from '@/app/lib/push-guard'
import { deliver, headSubs, pushConfigured } from '@/app/lib/push-send'

export const runtime = 'nodejs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Two limits, because they stop different things. Per code: a registration
// happens once, so anything past a couple of sends is a replay. Per centre: a
// flood of real registrations should still not become a flood of buzzes on one
// head's phone (the DB already caps pending requests per centre at 300).
const PER_CODE = { limit: 3, windowMs: 10 * 60_000 }
const PER_CENTRE = { limit: 30, windowMs: 60_000 }

// Tell the head a student is waiting for approval.
//
// This is the one notification the app cannot send through /api/push: a student
// registering themselves has no Supabase session, so there is no bearer token to
// authenticate with, and the send was failing silently on every self-registration
// — the head got the in-app toast only if the app happened to be open, and
// nothing at all otherwise. The just-minted student code authorises the send
// instead: it is unguessable, it is re-read server-side, and it stops working
// the moment the request is approved or rejected.
export async function POST(req: NextRequest) {
  if (!url || !serviceKey || !pushConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const parsed = validateStudentRequest(await req.json().catch(() => ({})))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { code } = parsed.value

  if (await rateLimit(`sr:${code}`, PER_CODE.limit, PER_CODE.windowMs)) {
    return NextResponse.json({ error: 'too many requests — slow down' }, { status: 429 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: student } = await admin.from('students')
    .select('name, centre_id, status').eq('student_code', code).single()

  // Not pending means the code is either unknown or already dealt with. Both
  // get the same answer — a caller must not be able to probe which codes exist.
  if (!student || student.status !== 'pending' || !student.centre_id) {
    return NextResponse.json({ sent: 0 })
  }
  const centre = student.centre_id as string

  if (await rateLimit(`sr-centre:${centre}`, PER_CENTRE.limit, PER_CENTRE.windowMs)) {
    return NextResponse.json({ error: 'too many requests — slow down' }, { status: 429 })
  }

  const subs = await headSubs(admin, centre)
  if (!subs.length) return NextResponse.json({ sent: 0 })

  const { data: centreRow } = await admin.from('centres').select('name').eq('id', centre).single()
  const centreName = centreRow?.name ?? ''

  // The head sees the message as written — it is their own centre, and stamping
  // their own name on a request they are waiting for is just noise. The name is
  // read from the row, never from the request body, so the notification can only
  // ever say who actually registered.
  const payload = JSON.stringify({
    title: 'New student request',
    body: `${student.name} has requested to join. Review and approve.`,
    url: '/',
    centre: centreName,
  })

  const { sent, undelivered } = await deliver(admin, [{ subs, payload }], centre)
  return NextResponse.json({ sent, ...(undelivered ? { undelivered } : {}) })
}
