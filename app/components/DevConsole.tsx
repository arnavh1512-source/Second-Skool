'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDashboard, SESSION_EXPIRED, devFetch, fmtDate, timeAgo } from '../store'
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
  heads: number
  students: Counts
  branches: number
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
    students: number; studentsPending: number; branches: number
    activity7d: number; activity30d: number
    newStudents7d: number; newStaff7d: number
  }
  // What the system itself is doing, as opposed to what the centres are doing.
  health: {
    phonesLive: number; phonesWaiting: number; codeAttempts5m: number
    migrations: number; migrationLatest: string | null
  }
  centres: CentreRow[]
  staff: StaffRow[]
  alerts: string[]
  errors: string[]
}

// A support report as the inbox reads it: snake_case straight from PostgREST,
// because nothing else in the console consumes it and a mapping layer for one
// caller is a layer for nobody.
type TicketMessage = { author: 'reporter' | 'operator'; body: string; created_at: string }
type Ticket = {
  id: string
  created_at: string
  centre_name: string
  reporter_name: string
  reporter_role: string
  intent: string
  outcome: string
  area: string
  frequency: string
  diagnostics: { version?: string; viewport?: string; userAgent?: string; lastError?: string | null }
  shot: string | null
  status: 'open' | 'resolved'
  support_messages: TicketMessage[]
}

// "3h ago" / "12d ago" — an absolute timestamp is noise when the only question
// is whether someone has been here recently. A column that has never happened
// says so; timeAgo has nothing to measure from.
const ago = (iso: string | null): string => (iso ? timeAgo(iso) || '—' : 'never')

// Kept outside the component so the mount effect can call it without touching
// React state synchronously — every setState below happens in a callback.
const fetchSnapshot = (): Promise<Snapshot> => devFetch<Snapshot>('/api/dev')
const fetchTickets = (): Promise<{ tickets: Ticket[] }> => devFetch('/api/dev?view=tickets')

const FREQ_LABEL: Record<string, string> = { always: 'Every time', sometimes: 'Sometimes', first: 'First time' }

export function DevConsoleScreen() {
  const { exitDevConsole, devDeleteCentre, devReplyTicket, devResolveTicket, signOut } = useDashboard()
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'centres' | 'people' | 'reports'>('centres')
  const [tickets, setTickets] = useState<Ticket[]>([])

  // The centre whose delete confirmation is open, and what has been typed into
  // it. Held here rather than per-card so opening one closes any other.
  const [doomed, setDoomed] = useState<CentreRow | null>(null)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Reports are their own read, so a slow snapshot never holds up a reply and a
  // failed one still shows the inbox. Open first, then newest.
  const loadTickets = useCallback(() => {
    fetchTickets()
      .then(r => setTickets([...(r.tickets ?? [])].sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'open' ? -1 : 1)))
      .catch(e => setError(e instanceof Error ? e.message : 'Could not read the reports'))
  }, [])

  const openReports = tickets.filter(t => t.status === 'open').length

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

  useEffect(() => {
    let alive = true
    settle(fetchSnapshot(), () => alive)
    loadTickets()
    return () => { alive = false }
  }, [settle, loadTickets])

  const refresh = () => {
    setLoading(true)
    settle(fetchSnapshot(), () => true)
    loadTickets()
  }

  return (
    <div className="td-wide td-screen">
      <ScreenHeader
        title="Developer console"
        onBack={exitDevConsole}
        right={
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[12px] font-bold py-[7px] px-3 rounded-[10px] cursor-pointer border border-td-border bg-td-card text-td-primary disabled:opacity-50"
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
        <div className="bg-td-wash-red border border-td-edge-red text-td-red text-[13px] rounded-[14px] p-3.5 mb-4 flex items-center gap-3">
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

      {loading && !data && !error && <div className="text-center text-td-muted text-sm py-12">Loading every centre…</div>}

      {data && (
        <>
          {data.errors.length > 0 && (
            <div className="bg-td-wash-amber border border-td-edge-amber text-td-on-amber text-[12px] rounded-[14px] p-3 mb-4">
              Partial data — could not read: {data.errors.join(', ')}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 mb-4 lg:grid-cols-3 xl:grid-cols-5">
            <Stat label="Centres" value={data.totals.centres} />
            <Stat label="Staff" value={data.totals.staffApproved} sub={data.totals.staffPending ? `${data.totals.staffPending} pending` : undefined} />
            <Stat label="Students" value={data.totals.students} sub={data.totals.studentsPending ? `${data.totals.studentsPending} pending` : undefined} />
            <Stat label="Branches" value={data.totals.branches} />
            <Stat label="Actions · 7d" value={data.totals.activity7d} sub={`${data.totals.activity30d} in 30d`} />
          </div>

          {/* The system's own vitals. Every one of these was already being
              written and none of it was being read: a phone waiting on a head
              who never saw the badge, a code being ground against the throttle,
              a migration file pasted into the SQL editor months ago and never
              confirmed. Three numbers, no dashboards. */}
          <div className="grid grid-cols-3 gap-2.5 mb-4 lg:max-w-2xl">
            <Stat
              label="Phones"
              value={data.health.phonesLive}
              sub={data.health.phonesWaiting ? `${data.health.phonesWaiting} waiting` : 'none waiting'}
              calm={data.health.phonesWaiting === 0}
            />
            <Stat
              label="Code attempts · 5m"
              value={data.health.codeAttempts5m}
              sub={data.health.codeAttempts5m >= 10 ? 'throttle holding' : 'quiet'}
              calm={data.health.codeAttempts5m < 10}
            />
            <Stat
              label="Migrations"
              value={data.health.migrations}
              // The full version string is a sentence; the number in front of
              // it is the thing being checked against the repository.
              sub={data.health.migrationLatest ? `latest ${data.health.migrationLatest.split('_')[0]}` : 'none recorded'}
              calm={data.health.migrationLatest !== null}
            />
          </div>

          {data.alerts.length > 0 && (
            <div className="td-card rounded-[16px] p-4 mb-4">
              <div className="text-[13px] td-strong mb-2">Needs attention</div>
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
            {(['centres', 'people', 'reports'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 text-[12.5px] font-bold py-2.5 rounded-[12px] cursor-pointer border capitalize ${tab === t ? 'bg-td-primary text-white border-td-primary' : 'bg-td-card text-td-text border-td-border'}`}
              >
                {t === 'reports' && openReports > 0 ? `reports (${openReports})` : t}
              </button>
            ))}
          </div>

          {tab === 'centres' && (
            <Centres
              rows={data.centres}
              onDelete={c => { setDoomed(c); setTyped(''); setError(null) }}
            />
          )}
          {tab === 'people' && <People rows={data.staff} />}
          {tab === 'reports' && (
            <Reports
              rows={tickets}
              onReply={(id, message) => devReplyTicket(id, message).then(loadTickets)}
              onResolve={id => devResolveTicket(id).then(loadTickets)}
            />
          )}

          <div className="text-[12px] text-td-subtle text-center mt-5">
            Snapshot {ago(data.generatedAt)} · this console reads aggregates only — it cannot open a centre or read its data.
          </div>
        </>
      )}

      {doomed && (
        <div className="fixed inset-0 z-[80] bg-black/45 flex items-end md:items-center justify-center p-4">
          <div className="bg-td-card rounded-[18px] p-5 w-full max-w-sm">
            <div className="text-[16px] td-strong">Delete {doomed.name}?</div>
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
              className="td-field text-[13.5px]"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setDoomed(null); setTyped('') }}
                disabled={deleting}
                className="flex-1 text-[13px] font-bold py-2.5 rounded-[12px] cursor-pointer border border-td-border bg-td-card text-td-text disabled:opacity-50"
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

// `sub` is amber because everywhere it appeared it meant "something is waiting".
// The health strip has subs that mean the opposite — nothing waiting, throttle
// quiet — and amber for good news is a false alarm every time the console opens.
function Stat({ label, value, sub, calm }: { label: string; value: number | string; sub?: string; calm?: boolean }) {
  return (
    <div className="td-card rounded-[16px] p-3.5">
      <div className="text-[12px] font-bold text-td-muted">{label}</div>
      <div className="text-[20px] td-strong mt-0.5 leading-tight">{value}</div>
      {sub && <div className={`text-[12px] mt-0.5 ${calm ? 'text-td-subtle' : 'text-td-amber'}`}>{sub}</div>}
    </div>
  )
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[12px] text-td-muted">{label}</div>
      <div className="text-[13px] td-strong">{value}</div>
      {sub && <div className="text-[12px] text-td-amber">{sub}</div>}
    </div>
  )
}

type CentresProps = {
  rows: CentreRow[]
  onDelete: (centre: CentreRow) => void
}

function Centres({ rows, onDelete }: CentresProps) {
  if (!rows.length) return <Empty>No centres yet.</Empty>
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
      {rows.map(c => (
        <div key={c.id} className="td-card rounded-[16px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] td-strong truncate">{c.name}</div>
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
            <Field label="Heads" value={`${c.heads}`} sub={c.heads > 1 ? 'full access' : undefined} />
            <Field label="Students" value={`${c.students.approved}`} sub={c.students.pending ? `${c.students.pending} pending` : undefined} />
            <Field label="Branches" value={`${c.branches}`} />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-td-line text-[12px] text-td-muted">
            <span>attendance {c.activity30d.attendance}</span>
            <span>results {c.activity30d.results}</span>
            <span>assignments {c.activity30d.assignments}</span>
            <span>tests {c.activity30d.tests}</span>
            <span>notes {c.activity30d.notes}</span>
            <span>reminders {c.activity30d.reminders}</span>
            <span className="text-td-subtle">(30d)</span>
          </div>

          <div className="text-[12px] text-td-subtle mt-2">
            created {fmtDate(c.createdAt)} · staff code {c.joinCode ?? '—'} · student code {c.studentJoinCode ?? '—'}
          </div>

          <div className="mt-3">
            <button
              onClick={() => onDelete(c)}
              aria-label={`Delete ${c.name}`}
              className="w-full text-[12.5px] font-extrabold py-2.5 rounded-[12px] td-danger"
            >
              Delete centre
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
        <div key={s.id} className="td-card rounded-[16px] p-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] td-strong truncate">{s.name ?? '—'}</div>
            <div className="text-[12px] text-td-muted truncate">{s.email ?? '—'}</div>
            <div className="text-[12px] text-td-subtle truncate">
              {s.centre ?? 'unattached'} · {s.role === 'admin' ? 'head' : s.role} · joined {fmtDate(s.createdAt)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className="text-[12px] font-extrabold rounded-md px-2 py-0.5 inline-block"
              style={
                s.status === 'approved' ? { background: 'var(--color-td-tint-green)', color: 'var(--color-td-green)' }
                  : s.status === 'pending' ? { background: 'var(--color-td-tint-amber)', color: 'var(--color-td-amber)' }
                  : s.status === 'rejected' ? { background: 'var(--color-td-tint-red)', color: 'var(--color-td-red)' }
                  : { background: 'var(--color-td-soft)', color: 'var(--color-td-muted)' }
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
  return <div className="text-center text-td-muted text-sm py-10 td-card rounded-[16px]">{children}</div>
}

// The inbox. Collapsed, a report is who and what; expanded it is everything the
// reporter's browser could tell us, because the console can no longer open a
// centre to go and look.
function Reports({ rows, onReply, onResolve }: {
  rows: Ticket[]
  onReply: (id: string, message: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (rows.length === 0)
    return <div className="text-center text-td-muted text-sm py-10">No reports yet.</div>

  const send = (id: string) => {
    const text = draft.trim()
    if (!text) return
    setBusy(true)
    onReply(id, text).then(() => setDraft('')).finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(t => {
        const open = openId === t.id
        const d = t.diagnostics ?? {}
        return (
          <div key={t.id} className="td-card rounded-[16px] overflow-hidden">
            <button
              onClick={() => { setOpenId(open ? null : t.id); setDraft('') }}
              className="td-plain w-full text-left p-4 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm td-strong">{t.intent}</div>
                  <div className="text-[12px] text-td-muted mt-0.5 truncate">
                    {t.reporter_name || 'Someone'} · {t.reporter_role || 'unknown role'} · {t.centre_name || 'no centre'}
                  </div>
                </div>
                <span
                  className="text-[11px] font-extrabold rounded-full py-1 px-2.5 shrink-0"
                  style={t.status === 'open'
                    ? { background: 'var(--color-td-tint-blue)', color: 'var(--color-td-primary)' }
                    : { background: 'var(--color-td-soft)', color: 'var(--color-td-muted)' }}
                >
                  {t.status === 'open' ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                <Chip>{t.area}</Chip>
                <Chip>{FREQ_LABEL[t.frequency] ?? t.frequency}</Chip>
                <Chip>{fmtDate(t.created_at)}</Chip>
                {t.support_messages.length > 0 && <Chip>{t.support_messages.length} messages</Chip>}
              </div>
            </button>

            {open && (
              <div className="border-t border-td-line p-4 flex flex-col gap-3">
                <div>
                  <div className="text-[11px] font-extrabold text-td-muted mb-1">What happened instead</div>
                  <div className="text-[13px] text-td-text leading-[1.55] whitespace-pre-wrap">{t.outcome}</div>
                </div>

                <div className="text-[11px] text-td-muted font-mono leading-[1.6] break-all">
                  {d.version ?? '?'} · {d.viewport ?? '?'} · {d.userAgent ?? '?'}
                </div>
                {d.lastError && (
                  <div className="text-td-red font-mono text-[11px] break-all bg-td-wash-red rounded-[10px] p-2.5">
                    {d.lastError}
                  </div>
                )}

                {t.shot && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={t.shot} alt="Reporter's screenshot" className="w-full rounded-[12px] border border-td-border" />
                )}

                {t.support_messages.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {[...t.support_messages]
                      .sort((a, b) => a.created_at.localeCompare(b.created_at))
                      .map((m, i) => (
                        <div
                          key={i}
                          className={`text-[13px] leading-[1.5] rounded-[12px] p-2.5 px-3 whitespace-pre-wrap ${m.author === 'operator' ? 'bg-td-tint-blue text-td-dark' : 'bg-td-soft text-td-text'}`}
                        >
                          <div className="text-[11px] font-extrabold text-td-muted mb-1">
                            {m.author === 'operator' ? 'You' : t.reporter_name || 'Reporter'} · {fmtDate(m.created_at)}
                          </div>
                          {m.body}
                        </div>
                      ))}
                  </div>
                )}

                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Reply — they see this inside the app"
                  rows={3}
                  className="td-field text-[13px] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => send(t.id)}
                    disabled={busy || !draft.trim()}
                    className="td-pill flex-1 text-[12.5px] font-extrabold py-2.5 rounded-[12px] cursor-pointer disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : 'Send reply'}
                  </button>
                  {t.status === 'open' && (
                    <button
                      onClick={() => onResolve(t.id)}
                      className="text-[12.5px] font-extrabold py-2.5 px-3.5 rounded-[12px] cursor-pointer border border-td-border bg-td-card text-td-muted"
                    >
                      Close report
                    </button>
                  )}
                </div>
                {t.status === 'open' && t.shot && (
                  <div className="text-[11px] text-td-subtle">Closing also deletes the screenshot.</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold text-td-muted bg-td-soft rounded-full py-1 px-2.5">{children}</span>
  )
}
