'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ---- shape of /api/dev ------------------------------------------------------
type Counts = { approved: number; pending: number; rejected: number }
type Activity = { attendance: number; results: number; assignments: number; tests: number; notes: number; reminders: number; total: number }
type Centre = {
  id: string
  name: string
  joinCode: string | null
  studentJoinCode: string | null
  createdAt: string
  owner: { name: string | null; email: string | null; lastSignIn: string | null } | null
  staff: Counts
  students: Counts
  devices: number
  fees: { collected: number; outstanding: number; overdue: number }
  activity7d: Activity
  activity30d: Activity
  lastActive: string | null
}
type Staff = {
  id: string
  name: string | null
  email: string | null
  role: string
  status: string
  centre: string | null
  createdAt: string
  lastSignIn: string | null
}
type Snapshot = {
  generatedAt: string
  windowDays: number
  totals: {
    centres: number; staffApproved: number; staffPending: number
    students: number; studentsPending: number; devices: number
    activity7d: number; activity30d: number
    newStudents7d: number; newStaff7d: number
    feesCollected: number; feesOutstanding: number
  }
  centres: Centre[]
  staff: Staff[]
  alerts: string[]
  errors: string[]
}

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

// "3h ago" / "12d ago" — absolute timestamps are noise when the only question
// is whether someone has been here recently.
const ago = (iso: string | null): string => {
  if (!iso) return 'never'
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function DevPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'centres' | 'people'>('centres')
  const loadedFor = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: s } = await supabase.auth.getSession()
      const token = s.session?.access_token
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/dev', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
      setData(json as Snapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auth is the external system here: the session arrives asynchronously and
  // again on every sign-in/out. `loadedFor` dedupes — Supabase replays the
  // current session as INITIAL_SESSION, which would otherwise double-fetch.
  useEffect(() => {
    let alive = true
    const sync = (uid: string | null, mail: string | null) => {
      if (!alive) return
      setEmail(mail)
      if (!uid) { loadedFor.current = null; setData(null); return }
      if (loadedFor.current === uid) return
      loadedFor.current = uid
      void load()
    }
    supabase.auth.getSession().then(({ data: s }) => {
      if (!alive) return
      setReady(true)
      sync(s.session?.user.id ?? null, s.session?.user.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      sync(s?.user.id ?? null, s?.user.email ?? null))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [load])

  if (!ready) return <Centered>Loading…</Centered>

  if (!email)
    return (
      <Centered>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-td-dark">Developer console</h1>
          <p className="mt-2 text-sm text-td-muted">Operator access only.</p>
          <button
            onClick={() => supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: `${window.location.origin}/dev` },
            })}
            className="mt-6 rounded-xl bg-td-primary px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Sign in with Google
          </button>
        </div>
      </Centered>
    )

  return (
    <div className="td-scrollable min-h-screen bg-td-bg px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-td-dark sm:text-2xl">Developer console</h1>
            <p className="text-xs text-td-muted">
              {email}
              {data && <> · snapshot {ago(data.generatedAt)}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="rounded-lg border border-td-border bg-white px-4 py-2 text-sm font-semibold text-td-text disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-lg border border-td-border bg-white px-4 py-2 text-sm font-semibold text-td-muted"
            >
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <p className="mt-6 rounded-xl border border-td-red/30 bg-td-red/5 p-4 text-sm text-td-red">{error}</p>
        )}

        {data && (
          <>
            {data.errors.length > 0 && (
              <p className="mt-4 rounded-xl border border-td-amber/30 bg-td-amber/5 p-3 text-xs text-td-amber">
                Partial data — could not read: {data.errors.join(', ')}
              </p>
            )}

            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Centres" value={data.totals.centres} />
              <Stat label="Staff" value={data.totals.staffApproved} sub={data.totals.staffPending ? `${data.totals.staffPending} pending` : undefined} />
              <Stat label="Students" value={data.totals.students} sub={data.totals.studentsPending ? `${data.totals.studentsPending} pending` : undefined} />
              <Stat label="Push devices" value={data.totals.devices} />
              <Stat label="Actions · 7d" value={data.totals.activity7d} sub={`${data.totals.activity30d} in 30d`} />
              <Stat label="Fees collected" value={inr(data.totals.feesCollected)} sub={`${inr(data.totals.feesOutstanding)} due`} />
            </section>

            {data.alerts.length > 0 && (
              <section className="mt-6 rounded-2xl border border-td-border bg-white p-4">
                <h2 className="text-sm font-bold text-td-dark">Needs attention</h2>
                <ul className="mt-2 space-y-1.5">
                  {data.alerts.map(a => (
                    <li key={a} className="flex gap-2 text-sm text-td-text">
                      <span className="text-td-amber">•</span>{a}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <nav className="mt-6 flex gap-2">
              {(['centres', 'people'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                    tab === t ? 'bg-td-dark text-white' : 'border border-td-border bg-white text-td-muted'
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>

            {tab === 'centres' ? <Centres rows={data.centres} /> : <People rows={data.staff} />}

            <p className="mt-8 pb-8 text-center text-xs text-td-subtle">
              Aggregates only — no student names, parent contacts or addresses are read by this page.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="td-scrollable flex min-h-screen items-center justify-center bg-td-bg p-6 text-sm text-td-muted">
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-td-border bg-white p-4">
      <p className="text-xs font-medium text-td-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-td-dark">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-td-amber">{sub}</p>}
    </div>
  )
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-td-muted">{label}</p>
      <p className="font-semibold text-td-dark">{value}</p>
      {sub && <p className="text-xs text-td-amber">{sub}</p>}
    </div>
  )
}

function Centres({ rows }: { rows: Centre[] }) {
  if (!rows.length) return <Empty>No centres yet.</Empty>
  return (
    <div className="mt-4 space-y-3">
      {rows.map(c => (
        <article key={c.id} className="rounded-2xl border border-td-border bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-td-dark">{c.name}</h3>
              <p className="text-xs text-td-muted">
                {c.owner?.name ?? 'no owner'}
                {c.owner?.email && <> · {c.owner.email}</>}
                {' · '}last sign-in {ago(c.owner?.lastSignIn ?? null)}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${c.activity7d.total ? 'text-td-green' : 'text-td-subtle'}`}>
                {c.activity7d.total} actions · 7d
              </p>
              <p className="text-xs text-td-muted">last activity {ago(c.lastActive)}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Field label="Staff" value={`${c.staff.approved}`} sub={c.staff.pending ? `${c.staff.pending} pending` : undefined} />
            <Field label="Students" value={`${c.students.approved}`} sub={c.students.pending ? `${c.students.pending} pending` : undefined} />
            <Field label="Devices" value={`${c.devices}`} />
            <Field label="Fees" value={inr(c.fees.collected)} sub={c.fees.outstanding ? `${inr(c.fees.outstanding)} due` : undefined} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-td-border pt-3 text-xs text-td-muted">
            <span>attendance {c.activity30d.attendance}</span>
            <span>results {c.activity30d.results}</span>
            <span>assignments {c.activity30d.assignments}</span>
            <span>tests {c.activity30d.tests}</span>
            <span>notes {c.activity30d.notes}</span>
            <span>reminders {c.activity30d.reminders}</span>
            <span className="text-td-subtle">(30d)</span>
          </div>

          <p className="mt-2 text-xs text-td-subtle">
            created {day(c.createdAt)} · staff code {c.joinCode ?? '—'} · student code {c.studentJoinCode ?? '—'}
          </p>
        </article>
      ))}
    </div>
  )
}

function People({ rows }: { rows: Staff[] }) {
  if (!rows.length) return <Empty>No staff accounts yet.</Empty>
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-td-border bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-td-border text-left text-xs text-td-muted">
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium">Centre</th>
            <th className="p-3 font-medium">Role</th>
            <th className="p-3 font-medium">Status</th>
            <th className="p-3 font-medium">Joined</th>
            <th className="p-3 font-medium">Last sign-in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <tr key={s.id} className="border-b border-td-border/60 last:border-0">
              <td className="p-3">
                <span className="font-medium text-td-dark">{s.name ?? '—'}</span>
                <span className="block text-xs text-td-muted">{s.email ?? '—'}</span>
              </td>
              <td className="p-3 text-td-text">{s.centre ?? <span className="text-td-subtle">unattached</span>}</td>
              <td className="p-3 capitalize text-td-text">{s.role === 'admin' ? 'head' : s.role}</td>
              <td className="p-3">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  s.status === 'approved' ? 'bg-td-green/10 text-td-green'
                    : s.status === 'pending' ? 'bg-td-amber/10 text-td-amber'
                    : s.status === 'rejected' ? 'bg-td-red/10 text-td-red'
                    : 'bg-td-bg text-td-muted'
                }`}>{s.status}</span>
              </td>
              <td className="p-3 text-xs text-td-muted">{day(s.createdAt)}</td>
              <td className="p-3 text-xs text-td-muted">{ago(s.lastSignIn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-2xl border border-td-border bg-white p-8 text-center text-sm text-td-muted">{children}</p>
}
