'use client'

import { useDashboard, initials, type Screen } from '../store'
import { reachSummary } from '../lib/reach'
import { funnelSummary, type Missed } from '../lib/funnel'
import { setupProgress } from '../lib/onboarding'
import { ChevronRight } from './Shell'
import { Icon, ink, type IconName } from './Icon'
import { LastUpdated } from './LastUpdated'
import { ThemeToggle } from './ThemeToggle'

const CHIP = 'inline-flex items-center gap-[7px] td-card rounded-[20px] py-[7px] px-[13px]'
const chip = (name: string) => (
  <>
    <Icon name="branches" size={14} color="var(--color-td-primary)" />
    <span className="text-[12.5px] font-semibold text-td-text">{name}</span>
  </>
)

export function HomeScreen() {
  const { role, go, goFrom, schedule, students, branchesList, googleEmail, myName, pendingStudents, staffList, atRisk, studentDevices } = useDashboard()
  const isAdmin = role === 'admin'
  const pendingStaff = isAdmin ? staffList.filter(s => s.status === 'pending').length : 0
  const waitingPhones = studentDevices.filter(d => !d.allowed).length
  const hasAlerts = pendingStudents.length > 0 || pendingStaff > 0 || waitingPhones > 0
  const mainBranch = branchesList.find(b => b.main) ?? branchesList[0]
  const displayName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Admin' : 'Teacher')
  const ini = initials(displayName)

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
    { stage: 'dark', n: funnel?.dark ?? 0, label: 'never opened it', tint: 'var(--color-td-tint-red)' },
    { stage: 'once', n: funnel?.once ?? 0, label: 'opened it once', tint: 'var(--color-td-tint-amber)' },
    { stage: 'quiet', n: funnel?.quiet ?? 0, label: 'gone quiet', tint: 'var(--color-td-tint-blue)' },
  ] satisfies { stage: Missed; n: number; label: string; tint: string }[]).filter(c => c.n > 0)

  // The children who have stopped coming. Counted off the roster rather than
  // off the map, so the number here and the list on the other side can never
  // disagree — a student removed or unapproved since the last fetch is in
  // neither. The teacher sees it too: she is the one who knows why.
  const gone = students.filter(s => atRisk[s.dbId ?? '']).length

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
  const quickActions: { icon: IconName; label: string; tint: string; screen: Screen; tab?: string }[] = [
    { icon: 'attendance', label: 'Attendance', tint: 'var(--color-td-tint-green)', screen: 'attendance' },
    { icon: 'results', label: 'Results', tint: 'var(--color-td-tint-blue)', screen: 'results' },
    { icon: 'homework', label: 'Assignment', tint: 'var(--color-td-tint-amber)', screen: 'assign' },
    { icon: 'reminder', label: 'Reminder', tint: 'var(--color-td-tint-red)', screen: 'reminder' },
  ]

  return (
    <div className="td-wide td-screen">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => go('staffProfile')} aria-label="Open my profile" className="td-plain flex items-center gap-3 p-0 cursor-pointer text-left">
          <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{ini}</div>
          <div>
            <div className="text-xs text-td-muted font-semibold">{isAdmin ? 'Head Teacher' : 'Teacher'}</div>
            <div className="text-[17px] td-strong">{displayName}</div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button onClick={() => go('notifications', 'home')} aria-label="Notifications" className="relative w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer">
            <Icon name="reminder" size={20} color="var(--color-td-dark)" />
            {hasAlerts && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-td-card" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-[18px]">
        {/* Same chip either way, but only the head's is tappable - a plain div
            for everyone else, so it does not offer a screen they cannot open. */}
        {isAdmin ? (
          <button onClick={() => go('branches')} className={`${CHIP} cursor-pointer`}>
            {chip(mainBranch?.name ?? 'No branch')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-subtle)" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        ) : mainBranch ? (
          <div className={CHIP}>{chip(mainBranch.name)}</div>
        ) : <span />}
        <LastUpdated />
      </div>

      {steps.length > 0 && (
        <div className="td-card rounded-[18px] p-4 mb-3.5 lg:max-w-md">
          <div className="text-[11px] font-bold text-td-muted uppercase tracking-[.06em]">Get your centre running</div>
          <p className="text-[12.5px] text-td-muted leading-relaxed mt-1.5 mb-3">
            Three things, once. After that the app fills itself in as you teach.
          </p>
          <div className="flex flex-col gap-2">
            {steps.map((s, i) => (
              <button
                key={s.label}
                onClick={s.onClick}
                // The tick and the strike-through are the whole status for a
                // sighted head; neither reaches a screen reader on its own.
                aria-label={`${s.label} — ${s.done ? 'done' : 'not done yet'}`}
                className="td-plain flex items-center gap-3 text-left w-full p-0 cursor-pointer"
              >
                <span
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[12px] font-extrabold ${s.done ? 'bg-td-tint-green text-td-green' : 'bg-td-soft text-td-subtle'}`}
                  aria-hidden="true"
                >
                  {s.done ? <Icon name="check" size={15} color="var(--color-td-green)" /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13px] font-bold ${s.done ? 'text-td-subtle line-through' : 'text-td-dark'}`}>{s.label}</span>
                  {!s.done && <span className="block text-[11.5px] text-td-muted mt-0.5">{s.hint}</span>}
                </span>
                {!s.done && <ChevronRight />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-3.5 lg:max-w-md">
        <div className="rounded-[18px] p-3.5 text-white" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
          <div className="text-2xl font-extrabold leading-none">{schedule.length}</div>
          <div className="text-[12px] opacity-85 mt-1.5 font-semibold">Classes today</div>
        </div>
        <div className="td-card rounded-[18px] p-3.5">
          <div className="text-2xl font-extrabold leading-none text-td-dark">{students.length}</div>
          <div className="text-[12px] text-td-muted mt-1.5 font-semibold">Students</div>
        </div>
      </div>

      {/* Above parent reach because it outranks it: a family not looking is a
          problem, a child not turning up is a child already leaving. The card
          exists only while somebody is on the list, so a centre where everyone
          is coming never sees it — an alarm that is always on is furniture. */}
      {gone > 0 && (
        <button onClick={() => goFrom('students', 'students', 'atRisk')} className="flex items-center gap-3 text-left w-full bg-td-tint-red border border-td-edge-red rounded-[18px] py-3 px-4 mb-2.5 lg:max-w-md cursor-pointer">
          <div className="text-xl td-strong leading-none text-td-red">{gone}</div>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-td-dark">{gone === 1 ? 'student has' : 'students have'} stopped coming</div>
            <div className="text-[11.5px] text-td-subtle font-semibold mt-0.5">Absent the last 3 classes &middot; ask before the month ends</div>
          </div>
          <ChevronRight />
        </button>
      )}

      {/* Tapping through is the point: the head learns the number here and the
          names on the other side. origin='reach' is what carries the filter,
          and any later go() clears it, so the roster never stays half-hidden. */}
      {reach && (
        <button onClick={() => goFrom('students', 'students', 'reach')} className="block text-left w-full td-card rounded-[18px] py-3 px-4 mb-2.5 lg:max-w-md cursor-pointer">
          <div className="flex items-baseline gap-2">
            <span className="text-lg td-strong leading-none">{reach.active} of {students.length}</span>
            <span className="flex-1 text-[12px] text-td-muted font-semibold">families opened the app this week</span>
            <ChevronRight />
          </div>
          <div role="progressbar" aria-label="Families who opened the app this week" aria-valuenow={reach.percent} className="h-1.5 rounded-full bg-td-soft mt-2.5 overflow-hidden">
            <div className="h-full rounded-full bg-td-primary" style={{ width: `${reach.percent}%` }} />
          </div>
        </button>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3.5 lg:max-w-md">
          {chips.map(c => (
            <button key={c.stage} onClick={() => goFrom('students', 'students', c.stage)} className="td-plain cursor-pointer flex items-center gap-1.5 border border-td-border bg-td-card rounded-full py-1.5 px-3">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.tint }} />
              <span className="text-[12px] td-strong leading-none">{c.n}</span>
              <span className="text-[11.5px] text-td-muted font-semibold leading-none">{c.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="td-h2">Quick actions</div>
      <div className="grid grid-cols-4 gap-2 mb-[26px] lg:max-w-2xl">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => go(a.screen, (a.tab || 'home') as never)} className="border border-td-border bg-td-card rounded-[18px] py-3 px-0.5 cursor-pointer flex flex-col items-center gap-[7px]">
            <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center" style={{ background: a.tint, color: ink(a.tint) }}><Icon name={a.icon} size={21} /></div>
            <span className="text-[12px] font-bold text-td-text text-center leading-tight tracking-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="td-h2">Today&apos;s schedule</div>
      {schedule.length === 0 ? (
        <div className="td-none">No classes scheduled for today</div>
      ) : (
        <div className="td-list gap-2.5 mb-[26px]">
          {schedule.map((c, i) => (
            <div key={`${c.time}${c.ampm}-${c.subject}-${c.klass}-${i}`} className="flex items-center gap-[13px] td-card rounded-[18px] py-3.5 px-[15px]">
              <div className="text-center shrink-0 w-[52px]">
                <div className="text-sm font-extrabold text-td-primary">{c.time}</div>
                <div className="text-[12px] text-td-subtle font-semibold">{c.ampm}</div>
              </div>
              <div className="w-px h-[34px] bg-td-soft" />
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{c.subject}</div>
                <div className="text-xs text-td-muted mt-0.5">{c.klass} · {c.room}</div>
              </div>
              <span className="text-[12px] font-bold py-[5px] px-2.5 rounded-[20px]" style={{ color: c.statusColor, background: c.statusBg }}>{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
