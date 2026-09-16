'use client'

import { useDashboard, initials, rupee, type Screen } from '../store'
import { reachSummary } from '../lib/reach'
import { funnelSummary, type Missed } from '../lib/funnel'
import { setupProgress } from '../lib/onboarding'
import { ChevronRight } from './Shell'
import { Icon, type IconName } from './Icon'
import { LastUpdated } from './LastUpdated'
import { ThemeToggle } from './ThemeToggle'

// "TUE 16 SEP 2026". Built by hand because en-GB now spells September "Sept".
const today = () => {
  const d = new Date()
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', o)
  return `${part({ weekday: 'short' })} ${d.getDate()} ${part({ month: 'short' })} ${d.getFullYear()}`.toUpperCase()
}

// The one row shape of the register: a number, a name over its reason, a tag.
function Row({ n, title, sub, tag, tone, onClick }: { n: number; title: string; sub: string; tag: string; tone: 'red' | 'amber'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="td-plain w-full text-left cursor-pointer flex items-center gap-3 py-3 border-b border-td-line min-h-14">
      <span className="td-num text-td-caption text-td-muted border border-td-border px-1.5 py-[3px]">{String(n).padStart(2, '0')}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-td-body font-semibold text-td-dark truncate">{title}</span>
        <span className="block text-td-small text-td-muted mt-px truncate">{sub}</span>
      </span>
      <span className={`td-tag shrink-0 ${tone === 'red' ? 'bg-td-tint-red text-td-on-red' : 'bg-td-tint-amber text-td-on-amber'}`}>{tag}</span>
    </button>
  )
}

export function HomeScreen() {
  const { role, go, goFrom, schedule, students, branchesList, googleEmail, myName, pendingStudents, staffList, atRisk, attToday, studentDevices } = useDashboard()
  const isAdmin = role === 'admin'
  const pendingStaff = isAdmin ? staffList.filter(s => s.status === 'pending').length : 0
  const waitingPhones = studentDevices.filter(d => !d.allowed).length
  const hasAlerts = pendingStudents.length > 0 || pendingStaff > 0 || waitingPhones > 0
  const mainBranch = branchesList.find(b => b.main) ?? branchesList[0]
  const displayName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Admin' : 'Teacher')

  // Whether the families are actually looking is the number that decides
  // whether any of this was worth it, and nothing else on this screen says it.
  // The teacher who marks the register needs it as much as the head who pays
  // for the app: a parent who never opens it is a parent who never sees the
  // absence, and the teacher gets blamed for that at the end of term.
  const reach = students.length > 0 ? reachSummary(students) : null

  // "Missed" is not one problem, and the head cannot act on a lump. A family
  // that never got in needs the code sent again; one that looked once needs
  // walking through it; one that has gone quiet needs asking why. Three
  // different calls, so three separate numbers, each opening the list of names
  // to make them to.
  const funnel = reach && reach.missed > 0 ? funnelSummary(students, studentDevices) : null
  const chips = ([
    { stage: 'dark', n: funnel?.dark ?? 0, label: 'never opened it' },
    { stage: 'once', n: funnel?.once ?? 0, label: 'opened it once' },
    { stage: 'quiet', n: funnel?.quiet ?? 0, label: 'gone quiet' },
  ] satisfies { stage: Missed; n: number; label: string }[]).filter(c => c.n > 0)

  // Today's register, counted off the roster so a student removed since the
  // fetch is in neither number. Nothing marked yet is its own state, not 0%.
  const marks = students.map(s => attToday[s.dbId ?? '']).filter(Boolean)
  const present = marks.filter(m => m === 'Present').length
  const absent = marks.length - present
  const pct = marks.length ? Math.round((present / marks.length) * 100) : 0

  // Fees are the head's screen; a teacher is never shown the centre's money.
  const collected = isAdmin ? students.reduce((n, s) => n + (s.feeCollected ?? 0), 0) : 0
  const due = isAdmin ? students.reduce((n, s) => n + (s.feeDue ?? 0), 0) : 0

  // The children who have stopped coming, then (for the head) the overdue
  // fees. Above parent reach because it outranks it: a family not looking is a
  // problem, a child not turning up is a child already leaving. The block
  // exists only while somebody is on it — an alarm that is always on is
  // furniture. The teacher sees the absences too: she is the one who knows why.
  const attention = [
    ...students.filter(s => atRisk[s.dbId ?? '']).map(s => ({
      key: `a-${s.dbId}`, title: s.name, sub: `${s.klass} · stopped coming`, tag: `${atRisk[s.dbId!].missed} absent`, tone: 'red' as const,
      onClick: () => goFrom('students', 'students', 'atRisk'),
    })),
    ...(isAdmin ? students.filter(s => s.feeStatus === 'Overdue' && (s.feeDue ?? 0) > 0) : []).map(s => ({
      key: `f-${s.dbId ?? s.id}`, title: s.name, sub: `${s.klass} · fees overdue`, tag: rupee(s.feeDue!), tone: 'amber' as const,
      onClick: () => go('fees'),
    })),
  ]

  // Day one is a screen of zeros with no path out of it. Only the head sees
  // this — a teacher cannot add students or send codes, and a checklist you
  // are not allowed to action is just something in the way. It goes away for
  // good the moment the third step lands; there is no dismiss button because
  // there is nothing to dismiss once the centre is running.
  const setup = isAdmin ? setupProgress(students) : null
  const steps = setup && !setup.done ? [
    { label: 'Add your students', hint: 'Paste the list you already have', done: setup.roster, onClick: () => go('importStudents', 'students') },
    { label: 'Mark attendance once', hint: 'The first thing a parent will see', done: setup.register, onClick: () => go('attendance') },
    { label: 'Send the login codes', hint: 'A code nobody was sent is a login nobody uses', done: setup.parents, onClick: () => goFrom('students', 'students', 'reach') },
  ] : []

  // Home = the four quick daily shortcuts (same for head and teacher, clean
  // grid). Timetable is a bottom tab; Study material + all management (fees,
  // rankings, meetings, branches, subjects, reports, staff) live in More.
  const quickActions: { icon: IconName; label: string; screen: Screen }[] = [
    { icon: 'attendance', label: 'Attendance', screen: 'attendance' },
    { icon: 'results', label: 'Results', screen: 'results' },
    { icon: 'homework', label: 'Assignment', screen: 'assign' },
    { icon: 'reminder', label: 'Reminder', screen: 'reminder' },
  ]

  return (
    <div className="td-wide td-screen">
      <div className="flex items-center gap-3 pb-4">
        <div className="flex-1 min-w-0">
          <div className="text-td-title font-semibold tracking-[-.01em] text-td-dark truncate">{displayName}</div>
          <div className="td-num text-td-small text-td-muted mt-[5px]">
            {today()} · {schedule.length} {schedule.length === 1 ? 'class' : 'classes'}
          </div>
        </div>
        <ThemeToggle />
        <button onClick={() => go('notifications', 'home')} aria-label="Notifications" className="relative td-icon-btn shrink-0">
          <Icon name="reminder" size={20} color="var(--color-td-dark)" />
          {hasAlerts && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-td-card" />}
        </button>
        <button onClick={() => go('staffProfile')} aria-label="Open my profile" className="td-plain shrink-0 w-11 h-11 rounded-full bg-td-dark text-td-bg text-td-small font-semibold flex items-center justify-center cursor-pointer">
          {initials(displayName)}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-5">
        {/* Only the head's branch is tappable - a plain line for everyone
            else, so it does not offer a screen they cannot open. */}
        {isAdmin ? (
          <button onClick={() => go('branches')} className="td-plain p-0 cursor-pointer flex items-center gap-1.5 text-td-small font-semibold text-td-dark">
            <Icon name="branches" size={16} color="var(--color-td-dark)" />
            {mainBranch?.name ?? 'No branch'}
          </button>
        ) : mainBranch ? (
          <span className="flex items-center gap-1.5 text-td-small font-semibold text-td-dark">
            <Icon name="branches" size={16} color="var(--color-td-dark)" />{mainBranch.name}
          </span>
        ) : <span />}
        <LastUpdated />
      </div>

      <div className="lg:max-w-md">
        {steps.length > 0 && (
          <div className="mb-6">
            <div className="td-h2 mb-0">Get your centre running</div>
            {steps.map((s, i) => (
              <button
                key={s.label}
                onClick={s.onClick}
                // The tick and the strike-through are the whole status for a
                // sighted head; neither reaches a screen reader on its own.
                aria-label={`${s.label} — ${s.done ? 'done' : 'not done yet'}`}
                className="td-plain w-full text-left cursor-pointer flex items-center gap-3 py-3 border-b border-td-line min-h-14"
              >
                <span aria-hidden="true" className={`td-num text-td-caption border px-1.5 py-[3px] ${s.done ? 'bg-td-tint-green text-td-on-green border-td-green' : 'text-td-muted border-td-border'}`}>
                  {s.done ? '✓ ' : ''}{String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-td-body font-semibold ${s.done ? 'text-td-muted line-through' : 'text-td-dark'}`}>{s.label}</span>
                  {!s.done && <span className="block text-td-small text-td-muted mt-px">{s.hint}</span>}
                </span>
                {!s.done && <ChevronRight />}
              </button>
            ))}
          </div>
        )}

        <div className="td-h2 mb-4">Today · attendance</div>
        {marks.length === 0 ? (
          <button onClick={() => go('attendance')} className="td-plain w-full text-left cursor-pointer flex items-center gap-3 pb-6">
            <span className="flex-1">
              <span className="block text-td-body font-semibold text-td-dark">Not marked yet</span>
              <span className="block text-td-small text-td-muted mt-px">{students.length} {students.length === 1 ? 'student' : 'students'} on the register</span>
            </span>
            <ChevronRight />
          </button>
        ) : (
          <button onClick={() => go('attendance')} aria-label={`Attendance today: ${pct}%, ${present} present, ${absent} absent`} className="td-plain w-full text-left cursor-pointer block">
            <span className="flex items-end gap-3.5">
              <span className="td-num text-[40px] leading-10 font-semibold tracking-[-.03em] text-td-dark">{pct}%</span>
              <span className="pb-0.5">
                <span className="td-num block text-td-body font-medium text-td-on-green">{present} present</span>
                <span className="td-num block text-td-small text-td-muted">{absent} absent of {marks.length}</span>
              </span>
            </span>
            <span className="flex gap-0.5 h-2 mt-3.5 mb-6" aria-hidden="true">
              {present > 0 && <span className="bg-td-green" style={{ flexGrow: present }} />}
              {absent > 0 && <span className="bg-td-red" style={{ flexGrow: absent }} />}
            </span>
          </button>
        )}

        {isAdmin && collected + due > 0 && (
          <>
            <div className="td-h2 mb-3.5">Fees</div>
            <button onClick={() => go('fees')} className="td-plain w-full text-left cursor-pointer grid grid-cols-2 bg-td-card border border-td-border shadow-td-card mb-6">
              <span className="block px-[15px] py-3.5 border-r border-td-border">
                <span className="block text-td-caption font-semibold tracking-[.12em] uppercase text-td-muted">Collected</span>
                <span className="td-num block text-td-title font-semibold text-td-on-green mt-[7px]">{rupee(collected)}</span>
              </span>
              <span className="block px-[15px] py-3.5">
                <span className="block text-td-caption font-semibold tracking-[.12em] uppercase text-td-muted">Due</span>
                <span className="td-num block text-td-title font-semibold text-td-on-red mt-[7px]">{rupee(due)}</span>
              </span>
            </button>
          </>
        )}

        {attention.length > 0 && (
          <div className="mb-6">
            <div className="td-h2 mb-0">Needs attention</div>
            {attention.map(({ key, ...a }, i) => <Row key={key} n={i + 1} {...a} />)}
          </div>
        )}

        {/* Tapping through is the point: the head learns the number here and the
            names on the other side. origin='reach' is what carries the filter,
            and any later go() clears it, so the roster never stays half-hidden. */}
        {reach && (
          <>
            <div className="td-h2 mb-4">Parents · this week</div>
            <button onClick={() => goFrom('students', 'students', 'reach')} className="td-plain w-full text-left cursor-pointer block">
              <span className="flex items-baseline gap-2">
                <span className="td-num text-td-title font-semibold text-td-dark">{reach.active} of {students.length}</span>
                <span className="flex-1 text-td-small text-td-muted">families opened the app</span>
                <ChevronRight />
              </span>
              <span role="progressbar" aria-label="Families who opened the app this week" aria-valuenow={reach.percent} className={`block h-2 bg-td-line mt-3 overflow-hidden ${chips.length ? 'mb-3.5' : 'mb-6'}`}>
                <span className="block h-full bg-td-primary" style={{ width: `${reach.percent}%` }} />
              </span>
            </button>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {chips.map(c => (
                  <button key={c.stage} onClick={() => goFrom('students', 'students', c.stage)} className="td-plain cursor-pointer flex items-center gap-1.5 border border-td-border bg-td-card py-1.5 px-2.5 min-h-9">
                    <span className="td-num text-td-small font-semibold text-td-dark">{c.n}</span>
                    <span className="text-td-small text-td-muted">{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-td-border border border-td-border mb-[26px] lg:max-w-md">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => go(a.screen, 'home')} className="td-plain bg-td-card p-3.5 min-h-14 flex items-center gap-[11px] cursor-pointer text-left">
            <Icon name={a.icon} size={20} color="var(--color-td-dark)" />
            <span className="text-td-body font-semibold text-td-dark">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="td-h2 mb-0">Today&apos;s schedule</div>
      {schedule.length === 0 ? (
        <div className="td-none">No classes scheduled for today</div>
      ) : (
        <div className="mb-[26px]">
          {schedule.map((c, i) => (
            <div key={`${c.time}${c.ampm}-${c.subject}-${c.klass}-${i}`} className="flex items-center gap-3 py-3 border-b border-td-line min-h-14">
              <div className="td-num shrink-0 w-[60px] text-td-small font-semibold text-td-dark">
                {c.time}<span className="text-td-caption text-td-muted font-normal"> {c.ampm}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-td-body font-semibold text-td-dark truncate">{c.subject}</div>
                <div className="text-td-small text-td-muted mt-px truncate">{c.klass} · {c.room}</div>
              </div>
              <span className="td-tag shrink-0" style={{ color: c.statusColor, background: c.statusBg }}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
