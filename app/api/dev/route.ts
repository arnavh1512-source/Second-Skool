import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from '@/app/lib/push-guard'
import { logError, logWarn } from '@/app/lib/log'
import { verifyOperator } from '@/app/lib/operator'
import { ACTIVITY_TABLES, LEAF_TABLES, SPINE_TABLES } from '@/app/lib/centre-tables'

export const runtime = 'nodejs'
// Every response is a live snapshot of the database — never prerender or cache it.
export const dynamic = 'force-dynamic'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// PostgREST caps rows per request; ask for a generous page and report honestly
// when a table hits the ceiling rather than quietly under-counting.
const CAP = 10000
// Activity is fetched once over 30 days and sliced into the 7-day view in JS —
// one query per table instead of two.
const WINDOW_DAYS = 30

type Seat = { centreId: string; centreName: string }

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

type AuthUser = { id: string; last_sign_in_at?: string | null }

// listUsers is paginated at 1000 per call and silently returns only the first
// page. A single page looked like "everyone" right up until the 1001st account,
// at which point the operator console would start reporting long-standing users
// as never having signed in. Walk every page, with the same CAP the table
// queries use as the backstop.
async function listAllUsers(admin: SupabaseClient, errors: string[]): Promise<AuthUser[]> {
  const PER_PAGE = 1000
  const out: AuthUser[] = []
  try {
    for (let page = 1; out.length < CAP; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
      if (error) throw error
      const users = data?.users ?? []
      out.push(...users)
      if (users.length < PER_PAGE) return out
    }
    errors.push(`auth.users (truncated at ${CAP})`)
  } catch (e: unknown) {
    errors.push('auth.users')
    logError('dev.query_failed', { table: 'auth.users', message: e instanceof Error ? e.message : 'unknown' })
  }
  return out
}

// The service-role client below bypasses RLS entirely, so this function is the
// only authorization boundary the route has. Every handler starts here.
type Auth = { admin: SupabaseClient; uid: string; allowed: boolean }

async function authorize(req: NextRequest): Promise<Auth | NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: userData } = await admin.auth.getUser(token)
  const uid = userData.user?.id
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const verdict = verifyOperator(userData.user)
  // Holding the operator's address but failing the identity checks is not
  // ordinary traffic — it is either a misconfigured project or someone who has
  // managed to point an account at that address. Either way it wants a log line.
  if (!verdict.operator && verdict.reason !== 'not_listed')
    logWarn('dev.identity_rejected', { uid, reason: verdict.reason })

  return { admin, uid, allowed: verdict.operator }
}

// Which centre the operator is currently sitting inside, if any. Derived rather
// than stored: the operator owns no centre, so a `centre_id` on their profile
// that points at someone else's centre *is* an active session. Owning the
// centre would make them a real head, which is not impersonation.
async function currentSeat(admin: SupabaseClient, uid: string): Promise<Seat | null> {
  const { data: prof } = await admin.from('profiles').select('centre_id').eq('id', uid).maybeSingle()
  const centreId = (prof as { centre_id: string | null } | null)?.centre_id
  if (!centreId) return null
  const { data } = await admin.from('centres').select('id,name,owner_id').eq('id', centreId).maybeSingle()
  const centre = data as { id: string; name: string; owner_id: string | null } | null
  if (!centre || centre.owner_id === uid) return null
  return { centreId: centre.id, centreName: centre.name }
}

export async function GET(req: NextRequest) {
  if (!url || !serviceKey) return NextResponse.json({ error: 'not configured' }, { status: 500 })
  // `?probe=1` answers only "may I see this?" — it's what decides whether the
  // console entry appears at all. Keeping it a server round-trip means the
  // allowlist itself never reaches the browser.
  const probe = req.nextUrl.searchParams.get('probe') === '1'

  const auth = await authorize(req)
  if (auth instanceof NextResponse) return auth
  const { admin, uid, allowed } = auth

  // Rate-limit before the allowlist check so a valid session can't be used to
  // grind through the route, and log every rejection — an authenticated user
  // probing /api/dev is worth seeing in the logs.
  if (await rateLimit(`dev:${uid}`, 20, 60_000))
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  if (probe)
    return NextResponse.json(
      { allowed, seat: allowed ? await currentSeat(admin, uid) : null },
      { headers: { 'cache-control': 'no-store' } },
    )
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
    listAllUsers(admin, errors),
  ])

  const lastSignIn = new Map(authUsers.map(u => [u.id, u.last_sign_in_at ?? null]))
  const profileById = new Map(profiles.map(p => [p.id, p]))
  // O(1) lookup for the staff table below. `centres.find(...)` inside a .map()
  // over every profile is quadratic, and both sides are capped at CAP.
  const centreNameById = new Map(centres.map(c => [c.id, c.name]))

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
      centre: p.centre_id ? centreNameById.get(p.centre_id) ?? null : null,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const nostore = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

// Taking a seat inside a centre, rather than rebuilding CRUD for fourteen
// tables in the console. The operator's own profile is pointed at the target
// centre as an approved head, so every existing screen — students, fees,
// attendance, timetable, results — becomes editable with the app's own
// validation, its own RLS, and its own audit columns. Nothing here writes to
// customer data; the only row touched is the operator's.
//
// These three columns are revoked from `authenticated` at the grant level, so
// this can only happen through the service-role client behind the allowlist.
export async function POST(req: NextRequest) {
  if (!url || !serviceKey) return NextResponse.json({ error: 'not configured' }, { status: 500 })

  const auth = await authorize(req)
  if (auth instanceof NextResponse) return auth
  const { admin, uid, allowed } = auth

  if (await rateLimit(`dev-write:${uid}`, 10, 60_000))
    return NextResponse.json({ error: 'too many requests' }, { status: 429 })
  if (!allowed) {
    logWarn('dev.forbidden_write', { uid })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body: unknown = await req.json().catch(() => null)
  const action = (body as { action?: unknown } | null)?.action

  // Back to an unattached account: exactly the state a fresh Google sign-in
  // lands in, so the operator stops being a member of anyone's centre.
  if (action === 'leave') {
    const { error } = await admin
      .from('profiles')
      .update({ centre_id: null, role: 'student', staff_status: 'none', head_requested: false })
      .eq('id', uid)
    if (error) {
      logError('dev.leave_failed', { uid, message: error.message })
      return nostore({ error: 'could not leave the centre' }, 500)
    }
    logWarn('dev.seat_released', { uid })
    return nostore({ ok: true, seat: null })
  }

  if (action === 'enter') {
    const centreId = (body as { centreId?: unknown }).centreId
    if (typeof centreId !== 'string' || !UUID.test(centreId))
      return nostore({ error: 'invalid centre' }, 400)

    const { data, error: centreErr } = await admin
      .from('centres').select('id,name,owner_id').eq('id', centreId).maybeSingle()
    if (centreErr) {
      logError('dev.centre_lookup_failed', { uid, message: centreErr.message })
      return nostore({ error: 'could not read that centre' }, 500)
    }
    const centre = data as { id: string; name: string; owner_id: string | null } | null
    if (!centre) return nostore({ error: 'centre not found' }, 404)
    if (centre.owner_id === uid) return nostore({ error: 'you already own this centre' }, 400)

    // The profile-setup gate blocks every screen until a profile is complete.
    // Stamp it once so the operator isn't bounced into a form meant for staff,
    // but never overwrite details they have already filled in.
    const { data: existing } = await admin
      .from('profiles').select('full_name,profile_completed_at').eq('id', uid).maybeSingle()
    const prof = existing as { full_name: string | null; profile_completed_at: string | null } | null

    const { error } = await admin
      .from('profiles')
      .update({
        centre_id: centreId,
        role: 'admin',
        staff_status: 'approved',
        head_requested: false,
        ...(prof?.profile_completed_at ? {} : { profile_completed_at: new Date().toISOString() }),
        ...(prof?.full_name ? {} : { full_name: 'Second Skool support' }),
      })
      .eq('id', uid)
    if (error) {
      logError('dev.enter_failed', { uid, centre: centreId, message: error.message })
      return nostore({ error: 'could not enter that centre' }, 500)
    }

    logWarn('dev.seat_taken', { uid, centre: centreId })
    return nostore({ ok: true, seat: { centreId, centreName: centre.name } })
  }

  if (action === 'delete') return deleteCentre(admin, uid, body)

  return nostore({ error: 'unknown action' }, 400)
}


// Deleting a centre erases a real customer's entire history and cannot be
// undone from here. Two things stand between a stray tap and that: the request
// must repeat the centre's exact name, and the UI makes you type it.
async function deleteCentre(admin: SupabaseClient, uid: string, body: unknown): Promise<NextResponse> {
  const { centreId, confirm } = (body ?? {}) as { centreId?: unknown; confirm?: unknown }
  if (typeof centreId !== 'string' || !UUID.test(centreId)) return nostore({ error: 'invalid centre' }, 400)

  const { data, error: lookupErr } = await admin
    .from('centres').select('id,name').eq('id', centreId).maybeSingle()
  if (lookupErr) {
    logError('dev.delete_lookup_failed', { uid, message: lookupErr.message })
    return nostore({ error: 'could not read that centre' }, 500)
  }
  const centre = data as { id: string; name: string } | null
  if (!centre) return nostore({ error: 'centre not found' }, 404)
  if (typeof confirm !== 'string' || confirm.trim() !== centre.name)
    return nostore({ error: `type the centre name exactly to confirm: ${centre.name}` }, 400)

  logWarn('dev.centre_delete_started', { uid, centre: centreId })

  // Data first, members last. Detaching up front looked tidier, but the abort
  // below ("the centre was left in place") then left every member already
  // stripped of their centre_id: the head could no longer see the centre they
  // still own, and re-joining put them back as `pending` with no approved admin
  // left to approve them. Nobody can undo that from inside the app.
  const failed: string[] = []
  for (const table of [...LEAF_TABLES, ...SPINE_TABLES]) {
    const { error } = await admin.from(table).delete().eq('centre_id', centreId)
    if (error) {
      failed.push(table)
      logError('dev.delete_table_failed', { uid, centre: centreId, table, message: error.message })
    }
  }
  // Stop before the centre row itself: a half-deleted centre that still exists
  // can be retried or inspected, whereas an orphaned pile of rows whose centre
  // is gone is unreachable by every query in the app. Members are still
  // attached at this point, so the head keeps their way back in.
  if (failed.length)
    return nostore({ error: `could not clear: ${failed.join(', ')}. The centre was left in place.` }, 500)

  // Nothing can abort the delete from here, so release the members: once the
  // centre is gone their profiles would point at nothing, and they go back to
  // the unregistered state a fresh sign-in lands in. This also releases the
  // operator seat, which is why deleting a centre you are sitting inside works.
  const { error: detachErr } = await admin
    .from('profiles')
    .update({ centre_id: null, branch_id: null, role: 'student', staff_status: 'none', head_requested: false })
    .eq('centre_id', centreId)
  if (detachErr) {
    logError('dev.detach_failed', { uid, centre: centreId, message: detachErr.message })
    return nostore({ error: 'the centre data was cleared but its members could not be detached' }, 500)
  }

  const { error: centreErr } = await admin.from('centres').delete().eq('id', centreId)
  if (centreErr) {
    logError('dev.delete_centre_failed', { uid, centre: centreId, message: centreErr.message })
    return nostore({ error: 'the centre’s data was cleared but the centre could not be removed' }, 500)
  }

  logWarn('dev.centre_deleted', { uid, centre: centreId })
  return nostore({ ok: true, seat: null, deleted: centre.name })
}
