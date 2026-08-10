import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/app/lib/push-guard'
import { logError, logWarn } from '@/app/lib/log'

export const runtime = 'nodejs'
// Every response is a live snapshot of the database — never prerender or cache it.
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// The operator. Baked in rather than configured: there is exactly one person
// who runs this system, and an env var that can be forgotten in a new Vercel
// project is one more way to lock yourself out. This module is server-only, so
// the address never reaches the browser — the probe below is what the client
// gets to know.
const ALLOWED = ['arnavh1512@gmail.com']

// PostgREST caps rows per request; ask for a generous page and report honestly
// when a table hits the ceiling rather than quietly under-counting.
const CAP = 10000
// Activity is fetched once over 30 days and sliced into the 7-day view in JS —
// one query per table instead of two.
const WINDOW_DAYS = 30

type Ident = { id: string; centre_id: string | null }
type Dated = { centre_id: string | null; created_at: string }

type ProfileRow = Ident & {
  full_name: string | null
  email: string | null
  role: string
  staff_status: string
  created_at: string
}
type StudentRow = { centre_id: string | null; status: string; created_at: string }
type FeeRow = { centre_id: string | null; status: string; amount: number | string | null }
type CentreRow = {
  id: string
  name: string
  join_code: string | null
  student_join_code: string | null
  owner_id: string | null
  created_at: string
}

const ACTIVITY_TABLES = ['attendance', 'results', 'assignments', 'tests', 'notes', 'reminders'] as const
type ActivityTable = (typeof ACTIVITY_TABLES)[number]

const emptyCounts = (): Record<ActivityTable, number> =>
  Object.fromEntries(ACTIVITY_TABLES.map(t => [t, 0])) as Record<ActivityTable, number>

const num = (v: number | string | null): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? (n as number) : 0
}

// Wrap a query so one broken table can't take the whole dashboard down: the
// rest of the snapshot still renders and the failure is named in `errors`.
async function fetchRows<T>(
  label: string,
  run: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  errors: string[],
): Promise<T[]> {
  const { data, error } = await run()
  if (error) {
    errors.push(label)
    logError('dev.query_failed', { table: label, message: error.message })
    return []
  }
  const rows = data ?? []
  if (rows.length >= CAP) errors.push(`${label} (truncated at ${CAP})`)
  return rows
}

export async function GET(req: NextRequest) {
  if (!url || !serviceKey) return NextResponse.json({ error: 'not configured' }, { status: 500 })
  // `?probe=1` answers only "may I see this?" — it's what decides whether the
  // console entry appears in More. Keeping it a server round-trip means the
  // allowlist itself never reaches the browser.
  const probe = req.nextUrl.searchParams.get('probe') === '1'

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: userData } = await admin.auth.getUser(token)
  const uid = userData.user?.id
  const email = userData.user?.email?.toLowerCase() ?? ''
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Rate-limit before the allowlist check so a valid session can't be used to
  // grind through the route, and log every rejection — an authenticated user
  // probing /api/dev is worth seeing in the logs.
  if (await rateLimit(`dev:${uid}`, 20, 60_000))
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  const allowed = ALLOWED.includes(email)
  if (probe) return NextResponse.json({ allowed }, { headers: { 'cache-control': 'no-store' } })
  if (!allowed) {
    logWarn('dev.forbidden', { uid })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const now = Date.now()
  const since = new Date(now - WINDOW_DAYS * 86_400_000).toISOString()
  const sevenDaysAgo = now - 7 * 86_400_000
  const errors: string[] = []

  const [centres, profiles, students, fees, devices, activity, authUsers] = await Promise.all([
    fetchRows<CentreRow>('centres', () =>
      admin.from('centres').select('id,name,join_code,student_join_code,owner_id,created_at').limit(CAP), errors),
    fetchRows<ProfileRow>('profiles', () =>
      admin.from('profiles').select('id,full_name,email,role,staff_status,centre_id,created_at').limit(CAP), errors),
    fetchRows<StudentRow>('students', () =>
      admin.from('students').select('centre_id,status,created_at').limit(CAP), errors),
    fetchRows<FeeRow>('fees', () =>
      admin.from('fees').select('centre_id,status,amount').limit(CAP), errors),
    fetchRows<{ centre_id: string | null; kind: string }>('push_subscriptions', () =>
      admin.from('push_subscriptions').select('centre_id,kind').limit(CAP), errors),
    Promise.all(ACTIVITY_TABLES.map(async table => ({
      table,
      rows: await fetchRows<Dated>(table, () =>
        admin.from(table).select('centre_id,created_at').gte('created_at', since).limit(CAP), errors),
    }))),
    // Sign-in times live in auth.users, not profiles — this is the only way to
    // tell "signed up and never came back" from "here every day".
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      .then(r => r.data?.users ?? [])
      .catch((e: unknown) => {
        errors.push('auth.users')
        logError('dev.query_failed', { table: 'auth.users', message: e instanceof Error ? e.message : 'unknown' })
        return [] as { id: string; last_sign_in_at?: string | null }[]
      }),
  ])

  const lastSignIn = new Map(authUsers.map(u => [u.id, u.last_sign_in_at ?? null]))
  const profileById = new Map(profiles.map(p => [p.id, p]))

  // ---- per-centre roll-up ---------------------------------------------------
  type Bucket = {
    staff: { approved: number; pending: number; rejected: number }
    students: { approved: number; pending: number; rejected: number }
    fees: { collected: number; outstanding: number; overdue: number }
    devices: number
    d7: Record<ActivityTable, number>
    d30: Record<ActivityTable, number>
    lastActive: string | null
  }
  const buckets = new Map<string, Bucket>()
  const bucket = (id: string | null): Bucket | null => {
    if (!id) return null
    let b = buckets.get(id)
    if (!b) {
      b = {
        staff: { approved: 0, pending: 0, rejected: 0 },
        students: { approved: 0, pending: 0, rejected: 0 },
        fees: { collected: 0, outstanding: 0, overdue: 0 },
        devices: 0,
        d7: emptyCounts(),
        d30: emptyCounts(),
        lastActive: null,
      }
      buckets.set(id, b)
    }
    return b
  }
  centres.forEach(c => bucket(c.id))

  const bump = (obj: { approved: number; pending: number; rejected: number }, status: string) => {
    if (status === 'approved') obj.approved++
    else if (status === 'pending') obj.pending++
    else if (status === 'rejected') obj.rejected++
  }

  for (const p of profiles) {
    if (p.role === 'student') continue
    const b = bucket(p.centre_id)
    if (b) bump(b.staff, p.staff_status)
  }
  for (const s of students) {
    const b = bucket(s.centre_id)
    if (b) bump(b.students, s.status)
  }
  for (const f of fees) {
    const b = bucket(f.centre_id)
    if (!b) continue
    const amt = num(f.amount)
    if (f.status === 'Paid') b.fees.collected += amt
    else {
      b.fees.outstanding += amt
      if (f.status === 'Overdue') b.fees.overdue += amt
    }
  }
  for (const d of devices) {
    const b = bucket(d.centre_id)
    if (b) b.devices++
  }
  for (const { table, rows } of activity) {
    for (const r of rows) {
      const b = bucket(r.centre_id)
      if (!b) continue
      b.d30[table]++
      if (Date.parse(r.created_at) >= sevenDaysAgo) b.d7[table]++
      if (!b.lastActive || r.created_at > b.lastActive) b.lastActive = r.created_at
    }
  }

  const sum = (c: Record<ActivityTable, number>) => Object.values(c).reduce((a, b) => a + b, 0)

  const centreRows = centres.map(c => {
    const b = bucket(c.id)!
    const owner = c.owner_id ? profileById.get(c.owner_id) : undefined
    return {
      id: c.id,
      name: c.name,
      joinCode: c.join_code,
      studentJoinCode: c.student_join_code,
      createdAt: c.created_at,
      owner: owner
        ? {
            name: owner.full_name,
            email: owner.email,
            lastSignIn: lastSignIn.get(owner.id) ?? null,
          }
        : null,
      staff: b.staff,
      students: b.students,
      devices: b.devices,
      fees: b.fees,
      activity7d: { ...b.d7, total: sum(b.d7) },
      activity30d: { ...b.d30, total: sum(b.d30) },
      lastActive: b.lastActive,
    }
  })
  centreRows.sort((a, b) => (b.activity7d.total - a.activity7d.total) || a.name.localeCompare(b.name))

  // ---- staff roster (operational metadata only, no student PII) -------------
  const staffRows = profiles
    .filter(p => p.role !== 'student')
    .map(p => ({
      id: p.id,
      name: p.full_name,
      email: p.email,
      role: p.role,
      status: p.staff_status,
      centre: p.centre_id ? centres.find(c => c.id === p.centre_id)?.name ?? null : null,
      createdAt: p.created_at,
      lastSignIn: lastSignIn.get(p.id) ?? null,
    }))
    .sort((a, b) => (b.lastSignIn ?? '').localeCompare(a.lastSignIn ?? ''))

  // ---- things that want a human's attention ---------------------------------
  const alerts: string[] = []
  const twoDaysAgo = now - 2 * 86_400_000
  for (const c of centreRows) {
    if (c.staff.pending > 0) alerts.push(`${c.name}: ${c.staff.pending} staff request${c.staff.pending > 1 ? 's' : ''} waiting`)
    if (c.students.pending > 0) alerts.push(`${c.name}: ${c.students.pending} student request${c.students.pending > 1 ? 's' : ''} waiting`)
    if (c.students.approved > 0 && c.devices === 0) alerts.push(`${c.name}: ${c.students.approved} students, no push devices registered`)
    const created = Date.parse(c.createdAt)
    if (c.activity7d.total === 0 && created < twoDaysAgo)
      alerts.push(`${c.name}: no activity in 7 days${c.lastActive ? '' : ' (never used)'}`)
  }
  const orphanStaff = profiles.filter(p => p.role !== 'student' && !p.centre_id && p.staff_status !== 'rejected').length
  if (orphanStaff) alerts.push(`${orphanStaff} signed-in staff not attached to any centre`)

  const totals = {
    centres: centres.length,
    staffApproved: staffRows.filter(s => s.status === 'approved').length,
    staffPending: staffRows.filter(s => s.status === 'pending').length,
    students: students.filter(s => s.status === 'approved').length,
    studentsPending: students.filter(s => s.status === 'pending').length,
    devices: devices.length,
    activity7d: centreRows.reduce((a, c) => a + c.activity7d.total, 0),
    activity30d: centreRows.reduce((a, c) => a + c.activity30d.total, 0),
    newStudents7d: students.filter(s => Date.parse(s.created_at) >= sevenDaysAgo).length,
    newStaff7d: staffRows.filter(s => Date.parse(s.createdAt) >= sevenDaysAgo).length,
    feesCollected: centreRows.reduce((a, c) => a + c.fees.collected, 0),
    feesOutstanding: centreRows.reduce((a, c) => a + c.fees.outstanding, 0),
  }

  return NextResponse.json(
    { generatedAt: new Date(now).toISOString(), windowDays: WINDOW_DAYS, totals, centres: centreRows, staff: staffRows, alerts, errors },
    { headers: { 'cache-control': 'no-store' } },
  )
}
