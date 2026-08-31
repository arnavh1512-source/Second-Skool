import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminClient, adminConfigured } from '@/app/lib/supabase-admin'
import { rateLimit } from '@/app/lib/push-guard'
import { logError, logWarn } from '@/app/lib/log'
import { verifyOperator } from '@/app/lib/operator'
import { ACTIVITY_TABLES, LEAF_TABLES, SPINE_TABLES } from '@/app/lib/centre-tables'

export const runtime = 'nodejs'
// Every response is a live snapshot of the database — never prerender or cache it.
export const dynamic = 'force-dynamic'


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

  const admin: SupabaseClient = adminClient()
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

export async function GET(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 })
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
      { allowed },
      { headers: { 'cache-control': 'no-store' } },
    )
  if (!allowed) {
    logWarn('dev.forbidden', { uid })
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // The support inbox is its own read: it is rows, not aggregates, and the
  // snapshot below is expensive enough that replying to a report should not
  // recompute thirty days of activity for every centre.
  if (req.nextUrl.searchParams.get('view') === 'tickets') return ticketsInbox(admin, uid)

  const now = Date.now()
  const since = new Date(now - WINDOW_DAYS * 86_400_000).toISOString()
  const sevenDaysAgo = now - 7 * 86_400_000
  const errors: string[] = []

  const [centres, profiles, students, branches, devices, phones, attempts, migrations, activity, authUsers] = await Promise.all([
    fetchRows<CentreRow>('centres', () =>
      admin.from('centres').select('id,name,join_code,student_join_code,owner_id,created_at').limit(CAP), errors),
    fetchRows<ProfileRow>('profiles', () =>
      admin.from('profiles').select('id,full_name,email,role,staff_status,centre_id,created_at').limit(CAP), errors),
    fetchRows<StudentRow>('students', () =>
      admin.from('students').select('centre_id,status,created_at').limit(CAP), errors),
    fetchRows<{ centre_id: string | null }>('branches', () =>
      admin.from('branches').select('centre_id').limit(CAP), errors),
    fetchRows<{ centre_id: string | null; kind: string }>('push_subscriptions', () =>
      admin.from('push_subscriptions').select('centre_id,kind').limit(CAP), errors),
    // The three reads behind the health strip. All of them already existed and
    // nothing was looking at them: a phone waiting on a head who never noticed,
    // a code being ground against the throttle, a migration pasted into the SQL
    // editor and forgotten. None of this is new machinery — it is the machinery
    // that was already running, finally reporting.
    fetchRows<{ centre_id: string | null; approved: boolean; revoked_at: string | null }>('student_devices', () =>
      admin.from('student_devices').select('centre_id,approved,revoked_at').limit(CAP), errors),
    // This table is a live throttle bucket, not a log: rows older than five
    // minutes are deleted by the functions that write it. A count here is
    // therefore "right now", and that is exactly what it is worth.
    fetchRows<{ id: number }>('code_attempts', () =>
      admin.from('code_attempts').select('id').limit(CAP), errors),
    fetchRows<{ version: string }>('schema_migrations', () =>
      admin.from('schema_migrations').select('version').order('version').limit(CAP), errors),
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
    // Everyone who can read this centre's students, parents and fees. Normally
    // one; grant_head can make more, and that is worth seeing at a glance.
    heads: number
    branches: number
    // Not displayed — it feeds the "students but no push devices" alert, which
    // is the same fact in the form that actually needs acting on.
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
        heads: 0,
        branches: 0,
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
    if (!b) continue
    bump(b.staff, p.staff_status)
    if (p.role === 'admin' && p.staff_status === 'approved') b.heads++
  }
  for (const s of students) {
    const b = bucket(s.centre_id)
    if (b) bump(b.students, s.status)
  }
  for (const br of branches) {
    const b = bucket(br.centre_id)
    if (b) b.branches++
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
      heads: b.heads,
      students: b.students,
      branches: b.branches,
      devices: b.devices,
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

  // ---- health strip ---------------------------------------------------------
  const livePhones = phones.filter(p => !p.revoked_at)
  const waitingByCentre = new Map<string, number>()
  for (const p of livePhones) {
    if (p.approved || !p.centre_id) continue
    waitingByCentre.set(p.centre_id, (waitingByCentre.get(p.centre_id) ?? 0) + 1)
  }
  for (const [id, n] of waitingByCentre)
    alerts.push(`${centreNameById.get(id) ?? 'Unknown centre'}: ${n} phone${n > 1 ? 's' : ''} waiting to be allowed`)
  // The throttle refuses the eleventh failure in a minute, so a bucket this
  // full is somebody working through the code space rather than a parent
  // mistyping. It is the only place that fact is visible at all.
  if (attempts.length >= 10)
    alerts.push(`${attempts.length} failed code attempts in the last 5 minutes — the throttle is holding`)

  const health = {
    phonesLive: livePhones.length,
    phonesWaiting: livePhones.filter(p => !p.approved).length,
    codeAttempts5m: attempts.length,
    migrations: migrations.length,
    migrationLatest: migrations.length ? migrations[migrations.length - 1].version : null,
  }

  const totals = {
    centres: centres.length,
    staffApproved: staffRows.filter(s => s.status === 'approved').length,
    staffPending: staffRows.filter(s => s.status === 'pending').length,
    students: students.filter(s => s.status === 'approved').length,
    studentsPending: students.filter(s => s.status === 'pending').length,
    branches: branches.length,
    activity7d: centreRows.reduce((a, c) => a + c.activity7d.total, 0),
    activity30d: centreRows.reduce((a, c) => a + c.activity30d.total, 0),
    newStudents7d: students.filter(s => Date.parse(s.created_at) >= sevenDaysAgo).length,
    newStaff7d: staffRows.filter(s => Date.parse(s.createdAt) >= sevenDaysAgo).length,
  }

  return NextResponse.json(
    { generatedAt: new Date(now).toISOString(), windowDays: WINDOW_DAYS, totals, health, centres: centreRows, staff: staffRows, alerts, errors },
    { headers: { 'cache-control': 'no-store' } },
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const nostore = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

// The console used to be able to point the operator's own profile at any
// centre as an approved head, which made every screen in the app editable for
// that centre's data. It was removed: the console reads aggregates, and there
// is no longer any way for support to read a customer's students, parents,
// fees or attendance. Deleting a centre — which the head asks for and confirms
// by name — is the only write left here.
export async function POST(req: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 500 })

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

  if (action === 'delete') return deleteCentre(admin, uid, body)
  if (action === 'ticketReply') return ticketReply(admin, uid, body)
  if (action === 'ticketResolve') return ticketResolve(admin, uid, body)

  return nostore({ error: 'unknown action' }, 400)
}


// Every support report with its whole thread. This is the one place in the
// console that reads rows a person wrote — and only because they wrote them to
// us on purpose.
async function ticketsInbox(admin: SupabaseClient, uid: string): Promise<NextResponse> {
  const { data, error } = await admin
    .from('support_tickets')
    .select('id,created_at,centre_name,reporter_name,reporter_role,intent,outcome,area,frequency,diagnostics,shot,status,support_messages(author,body,created_at)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    logError('dev.tickets_failed', { uid, message: error.message })
    return nostore({ error: 'could not read the reports' }, 500)
  }
  return nostore({ tickets: data ?? [] })
}

function ticketIdOf(body: unknown): string | null {
  const { ticketId } = (body ?? {}) as { ticketId?: unknown }
  return typeof ticketId === 'string' && UUID.test(ticketId) ? ticketId : null
}

async function ticketReply(admin: SupabaseClient, uid: string, body: unknown): Promise<NextResponse> {
  const ticketId = ticketIdOf(body)
  if (!ticketId) return nostore({ error: 'invalid report' }, 400)
  const { message } = (body ?? {}) as { message?: unknown }
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text || text.length > 4000) return nostore({ error: 'write a reply first' }, 400)

  const { error } = await admin
    .from('support_messages').insert({ ticket_id: ticketId, author: 'operator', body: text })
  if (error) {
    logError('dev.ticket_reply_failed', { uid, ticket: ticketId, message: error.message })
    return nostore({ error: 'could not send that reply' }, 500)
  }
  return nostore({ ok: true })
}

// Closing a report is also what erases its screenshot. That image is a
// customer's students and their parents' phone numbers, lent to us to answer
// one question — nothing else deletes it, so this has to.
async function ticketResolve(admin: SupabaseClient, uid: string, body: unknown): Promise<NextResponse> {
  const ticketId = ticketIdOf(body)
  if (!ticketId) return nostore({ error: 'invalid report' }, 400)

  const { error } = await admin
    .from('support_tickets').update({ status: 'resolved', shot: null }).eq('id', ticketId)
  if (error) {
    logError('dev.ticket_resolve_failed', { uid, ticket: ticketId, message: error.message })
    return nostore({ error: 'could not close that report' }, 500)
  }
  return nostore({ ok: true })
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

  // One transaction, in the database. The loop that used to live here was one
  // HTTP round trip per table, each committing on its own, so a failure halfway
  // through left a customer's centre with an arbitrary subset of its history
  // missing and no way back. delete_centre() either clears the lot — data,
  // members detached, centre row — or moves nothing at all. See migration 0033.
  //
  // The ordered table list still comes from centre-tables.ts, which
  // centre-delete-coverage.test.ts checks against the migrations on every run.
  const { data: result, error: delErr } = await admin.rpc('delete_centre', {
    p_centre_id: centreId,
    p_tables: [...LEAF_TABLES, ...SPINE_TABLES],
  })
  if (delErr) {
    logError('dev.delete_centre_failed', { uid, centre: centreId, message: delErr.message })
    return nostore({ error: 'could not delete that centre. Nothing was removed.' }, 500)
  }
  if (!(result as { deleted?: unknown } | null)?.deleted)
    return nostore({ error: 'centre not found' }, 404)

  logWarn('dev.centre_deleted', { uid, centre: centreId })
  return nostore({ ok: true, deleted: centre.name })
}
