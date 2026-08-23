'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDashboard, SESSION_EXPIRED, operatorToken } from '../store'
import { ScreenHeader } from './Shell'

// ---- shape of /api/dev ------------------------------------------------------
type Counts = { approved: number; pending: number; rejected: number }
type Activity = { attendance: number; results: number; assignments: number; tests: number; notes: number; reminders: number; total: number }
type CentreRow = {
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
type StaffRow = {
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
  totals: {
    centres: number; staffApproved: number; staffPending: number
    students: number; studentsPending: number; devices: number
    activity7d: number; activity30d: number
    newStudents7d: number; newStaff7d: number
    feesCollected: number; feesOutstanding: number
  }
  centres: CentreRow[]
  staff: StaffRow[]
  alerts: string[]
  errors: string[]
}

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

// "3h ago" / "12d ago" — an absolute timestamp is noise when the only question
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

// Kept outside the component so the mount effect can call it without touching
// React state synchronously — every setState below happens in a callback.
async function fetchSnapshot(): Promise<Snapshot> {
  const token = await operatorToken()
  if (!token) throw new Error(SESSION_EXPIRED)
  const res = await fetch('/api/dev', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json as Snapshot
}

export function DevConsoleScreen() {
  const { exitDevConsole, devSeat, devEnterCentre, devLeaveCentre, devDeleteCentre, signOut } = useDashboard()
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'centres' | 'people'>('centres')
  // Which centre is mid-request. The page reloads on success, so this only ever
  // clears on failure — and then it must clear, or the button stays dead.
  const [seating, setSeating] = useState<string | null>(null)

  // The centre whose delete confirmation is open, and what has been typed into
  // it. Held here rather than per-card so opening one closes any other.
  const [doomed, setDoomed] = useState<CentreRow | null>(null)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  const settle = useCallback((p: Promise<Snapshot>, alive: () => boolean) => {
    p.then(d => { if (alive()) { setData(d); setError(null) } })
      .catch(e => { if (alive()) { setError(e instanceof Error ? e.message : 'Something went wrong'); setData(null) } })
      .finally(() => { if (alive()) setLoading(false) })
  }, [])

  const confirmDelete = () => {
    if (!doomed) return
    setDeleting(true)
    setError(null)
    devDeleteCentre(doomed.id, typed)
      .then(() => {
        setDoomed(null)
        setTyped('')
        setLoading(true)
        settle(fetchSnapshot(), () => true)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not delete that centre'))
      .finally(() => setDeleting(false))
  }

  const seat = (centreId: string | null) => {
    setSeating(centreId ?? 'leave')
    setError(null)
    const p = centreId ? devEnterCentre(centreId) : devLeaveCentre()
    p.catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Could not switch centre')
      setSeating(null)
    })
  }

  useEffect(() => {
    let alive = true
    settle(fetchSnapshot(), () => alive)
    return () => { alive = false }
  }, [settle])

  const refresh = () => {
    setLoading(true)
    settle(fetchSnapshot(), () => true)
  }

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader
        title="Developer console"
        onBack={exitDevConsole}
        right={
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[12px] font-bold py-[7px] px-3 rounded-[10px] cursor-pointer border border-td-border bg-white text-td-primary disabled:opacity-50"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        }
      />

      {/* An expired session used to be a dead end: the message named the
          problem and every control on the page — back, Refresh — led nowhere,
          because the console sits outside the router and nothing here could
          reach the sign-in screen. Say what to do and provide the way to do it. */}
      {error && (
        <div className="bg-[#fdf3f0] border border-[#f4d8cf] text-td-red text-[13px] rounded-[14px] p-3.5 mb-4 flex items-center gap-3">
          <span className="flex-1 min-w-0">{error}</span>
          {error === SESSION_EXPIRED && (
            <button
              onClick={signOut}
              className="text-[12px] font-extrabold py-2 px-3 rounded-[10px] cursor-pointer border-none bg-td-red text-white shrink-0"
            >
              Sign in again
            </button>
          )}
        </div>
      )}

      {devSeat && (
        <div className="bg-[#fdf3f0] border border-[#f4d8cf] rounded-[14px] p-3.5 mb-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-extrabold text-td-red">Inside {devSeat.centreName}</div>
            <div className="text-[12px] text-td-muted">
              You are a head of this centre — every edit is real, and their staff list shows you.
            </div>
          </div>
          <button
            onClick={() => seat(null)}
            disabled={seating !== null}
            className="text-[12px] font-extrabold py-2 px-3 rounded-[10px] cursor-pointer border-none bg-td-red text-white shrink-0 disabled:opacity-50"
          >
            {seating === 'leave' ? '…' : 'Leave'}
          </button>
        </div>
      )}
      {loading && !data && !error && <div className="text-center text-td-muted text-sm py-12">Loading every centre…</div>}

      {data && (
        <>
          {data.errors.length > 0 && (
            <div className="bg-[#fdf7ea] border border-[#f2e2c0] text-[#8a6320] text-[12px] rounded-[14px] p-3 mb-4">
              Partial data — could not read: {data.errors.join(', ')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mb-4 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label="Centres" value={data.totals.centres} />
            <Stat label="Staff" value={data.totals.staffApproved} sub={data.totals.staffPending ? `${data.totals.staffPending} pending` : undefined} />
            <Stat label="Students" value={data.totals.students} sub={data.totals.studentsPending ? `${data.totals.studentsPending} pending` : undefined} />
            <Stat label="Push devices" value={data.totals.devices} />
            <Stat label="Actions · 7d" value={data.totals.activity7d} sub={`${data.totals.activity30d} in 30d`} />
            <Stat label="Fees paid" value={inr(data.totals.feesCollected)} sub={data.totals.feesOutstanding ? `${inr(data.totals.feesOutstanding)} due` : undefined} />
          </div>

          {data.alerts.length > 0 && (
            <div className="bg-white border border-td-border rounded-[16px] p-4 mb-4">
              <div className="text-[13px] font-extrabold text-td-dark mb-2">Needs attention</div>
              <ul className="flex flex-col gap-1.5">
                {data.alerts.map(a => (
                  <li key={a} className="text-[12.5px] text-td-text flex gap-2">
                    <span className="text-td-amber">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 mb-4 lg:max-w-xs">
            {(['centres', 'people'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer border capitalize"
                style={{ background: tab === t ? '#2a6fdb' : '#fff', color: tab === t ? '#fff' : '#3a4456', borderColor: tab === t ? '#2a6fdb' : '#e6eaf2' }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'centres'
            ? <Centres
                rows={data.centres}
                seatId={devSeat?.centreId ?? null}
                seating={seating}
                onSeat={seat}
                onDelete={c => { setDoomed(c); setTyped(''); setError(null) }}
              />
            : <People rows={data.staff} />}

          <div className="text-[12px] text-td-subtle text-center mt-5">
            Snapshot {ago(data.generatedAt)} · this view reads aggregates only. Open a centre to edit its data.
          </div>
        </>
      )}

      {doomed && (
        <div className="fixed inset-0 z-[80] bg-black/45 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-[18px] p-5 w-full max-w-sm">
            <div className="text-[16px] font-extrabold text-td-dark">Delete {doomed.name}?</div>
            <p className="text-[12.5px] text-td-text mt-2 leading-relaxed">
              This erases {doomed.students.approved} students, {doomed.staff.approved} staff memberships and every
              attendance record, result, fee and note belonging to this centre. Its members go back to being
              unregistered accounts. It cannot be undone from here.
            </p>
            <label className="block text-[12px] font-bold text-td-muted mt-3.5 mb-1.5">
              Type <span className="text-td-dark">{doomed.name}</span> to confirm
            </label>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              autoFocus
              className="w-full text-[13.5px] py-2.5 px-3 rounded-[12px] border border-td-border outline-none focus:border-td-primary"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setDoomed(null); setTyped('') }}
                disabled={deleting}
                className="flex-1 text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer border border-td-border bg-white text-td-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting || typed.trim() !== doomed.name}
                className="flex-1 text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer border-none bg-td-red text-white disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete for ever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white border border-td-border rounded-[16px] p-3.5">
      <div className="text-[12px] font-bold text-td-muted">{label}</div>
      <div className="text-[20px] font-extrabold text-td-dark mt-0.5 leading-tight">{value}</div>
      {sub && <div className="text-[12px] text-td-amber mt-0.5">{sub}</div>}
    </div>
  )
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] text-td-muted">{label}</div>
      <div className="text-[13px] font-extrabold text-td-dark">{value}</div>
      {sub && <div className="text-[12px] text-td-amber">{sub}</div>}
    </div>
  )
}

type CentresProps = {
  rows: CentreRow[]
  seatId: string | null
  seating: string | null
  onSeat: (centreId: string | null) => void
  onDelete: (centre: CentreRow) => void
}

function Centres({ rows, seatId, seating, onSeat, onDelete }: CentresProps) {
  if (!rows.length) return <Empty>No centres yet.</Empty>
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
      {rows.map(c => (
        <div key={c.id} className="bg-white border border-td-border rounded-[16px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold text-td-dark truncate">{c.name}</div>
              <div className="text-[12px] text-td-muted truncate">
                {c.owner?.name ?? 'no owner'}{c.owner?.email ? ` · ${c.owner.email}` : ''}
              </div>
              <div className="text-[12px] text-td-subtle">head last signed in {ago(c.owner?.lastSignIn ?? null)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`text-[13px] font-extrabold ${c.activity7d.total ? 'text-td-green' : 'text-td-subtle'}`}>
                {c.activity7d.total} · 7d
              </div>
              <div className="text-[12px] text-td-muted">active {ago(c.lastActive)}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3">
            <Field label="Staff" value={`${c.staff.approved}`} sub={c.staff.pending ? `${c.staff.pending} pending` : undefined} />
            <Field label="Students" value={`${c.students.approved}`} sub={c.students.pending ? `${c.students.pending} pending` : undefined} />
            <Field label="Devices" value={`${c.devices}`} />
            <Field label="Fees" value={inr(c.fees.collected)} sub={c.fees.outstanding ? `${inr(c.fees.outstanding)} due` : undefined} />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-[#f0f2f7] text-[12px] text-td-muted">
            <span>attendance {c.activity30d.attendance}</span>
            <span>results {c.activity30d.results}</span>
            <span>assignments {c.activity30d.assignments}</span>
            <span>tests {c.activity30d.tests}</span>
            <span>notes {c.activity30d.notes}</span>
            <span>reminders {c.activity30d.reminders}</span>
            <span className="text-td-subtle">(30d)</span>
          </div>

          <div className="text-[12px] text-td-subtle mt-2">
            created {day(c.createdAt)} · staff code {c.joinCode ?? '—'} · student code {c.studentJoinCode ?? '—'}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onSeat(c.id === seatId ? null : c.id)}
              disabled={seating !== null}
              className="flex-1 text-[12.5px] font-extrabold py-2.5 rounded-[12px] cursor-pointer border-none text-white disabled:opacity-50"
              style={{ background: c.id === seatId ? '#e8553c' : '#2a6fdb' }}
            >
              {seating === c.id ? 'Opening…' : c.id === seatId ? 'Leave this centre' : 'Open & edit as head'}
            </button>
            <button
              onClick={() => onDelete(c)}
              aria-label={`Delete ${c.name}`}
              className="text-[12.5px] font-extrabold py-2.5 px-3 rounded-[12px] cursor-pointer border border-[#f4d8cf] bg-[#fdf3f0] text-td-red shrink-0"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function People({ rows }: { rows: StaffRow[] }) {
  if (!rows.length) return <Empty>No staff accounts yet.</Empty>
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(s => (
        <div key={s.id} className="bg-white border border-td-border rounded-[16px] p-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-extrabold text-td-dark truncate">{s.name ?? '—'}</div>
            <div className="text-[12px] text-td-muted truncate">{s.email ?? '—'}</div>
            <div className="text-[12px] text-td-subtle truncate">
              {s.centre ?? 'unattached'} · {s.role === 'admin' ? 'head' : s.role} · joined {day(s.createdAt)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className="text-[12px] font-extrabold rounded-md px-2 py-0.5 inline-block"
              style={
                s.status === 'approved' ? { background: '#e7f5ee', color: '#2fa36b' }
                  : s.status === 'pending' ? { background: '#fcf3e3', color: '#e0962f' }
                  : s.status === 'rejected' ? { background: '#fdecea', color: '#e8553c' }
                  : { background: '#f0f2f7', color: '#6b7689' }
              }
            >
              {s.status}
            </span>
            <div className="text-[12px] text-td-muted mt-1">{ago(s.lastSignIn)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-td-muted text-sm py-10 bg-white border border-td-border rounded-[16px]">{children}</div>
}
