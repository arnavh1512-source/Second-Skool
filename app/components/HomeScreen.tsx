'use client'

import { useDashboard, initials, type Screen } from '../store'
import { reachSummary } from '../lib/reach'
import { ChevronRight } from './Shell'
import { Icon, ink, type IconName } from './Icon'
import { LastUpdated } from './LastUpdated'
import { ThemeToggle } from './ThemeToggle'

export function HomeScreen() {
  const { role, go, goFrom, schedule, students, branchesList, googleEmail, myName, pendingStudents, staffList } = useDashboard()
  const isAdmin = role === 'admin'
  const pendingStaff = isAdmin ? staffList.filter(s => s.status === 'pending').length : 0
  const hasAlerts = pendingStudents.length > 0 || pendingStaff > 0
  const mainBranch = branchesList.find(b => b.main) ?? branchesList[0]
  const displayName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Admin' : 'Teacher')
  const ini = initials(displayName)

  // Enrolment is what the head pays for; reach is what she gets. Nothing else
  // on this screen tells her whether the families are actually looking, and
  // that is the only number that decides whether the app was worth it.
  const reach = isAdmin && students.length > 0 ? reachSummary(students) : null

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
        <button onClick={() => go('staffProfile')} aria-label="Open my profile" className="flex items-center gap-3 border-none bg-transparent p-0 cursor-pointer text-left">
          <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{ini}</div>
          <div>
            <div className="text-xs text-td-muted font-semibold">{isAdmin ? 'Head Teacher' : 'Teacher'}</div>
            <div className="text-[17px] font-extrabold text-td-dark">{displayName}</div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button onClick={() => go('notifications', 'home')} aria-label="Notifications" className="relative w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-dark)" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            {hasAlerts && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-td-card" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-[18px]">
        {isAdmin ? (
          <button onClick={() => go('branches')} className="inline-flex items-center gap-[7px] bg-td-card border border-td-border rounded-[20px] py-[7px] px-[13px] cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
            <span className="text-[12.5px] font-semibold text-td-text">{mainBranch?.name ?? 'No branch'}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-subtle)" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        ) : mainBranch ? (
          <div className="inline-flex items-center gap-[7px] bg-td-card border border-td-border rounded-[20px] py-[7px] px-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
            <span className="text-[12.5px] font-semibold text-td-text">{mainBranch.name}</span>
          </div>
        ) : <span />}
        <LastUpdated />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5 lg:max-w-md">
        <div className="rounded-[18px] p-3.5 text-white" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
          <div className="text-2xl font-extrabold leading-none">{schedule.length}</div>
          <div className="text-[12px] opacity-85 mt-1.5 font-semibold">Classes today</div>
        </div>
        <div className="bg-td-card border border-td-border rounded-[18px] p-3.5">
          <div className="text-2xl font-extrabold leading-none text-td-dark">{students.length}</div>
          <div className="text-[12px] text-td-muted mt-1.5 font-semibold">Students</div>
        </div>
      </div>

      {/* Tapping through is the point: the head learns the number here and the
          names on the other side. origin='reach' is what carries the filter,
          and any later go() clears it, so the roster never stays half-hidden. */}
      {reach && (
        <button onClick={() => goFrom('students', 'students', 'reach')} className="block text-left bg-td-card border border-td-border rounded-[18px] p-4 mb-3.5 lg:max-w-md cursor-pointer">
          <div className="text-[11px] font-bold text-td-muted uppercase tracking-[.06em]">Parent reach &middot; this week</div>
          <div className="text-2xl font-extrabold text-td-dark leading-none mt-2">{reach.active} of {students.length}</div>
          <div className="text-[12px] text-td-muted font-semibold mt-1.5">families opened the app</div>
          <div role="progressbar" aria-label="Families who opened the app this week" aria-valuenow={reach.percent} className="h-1.5 rounded-full bg-td-soft mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-td-primary" style={{ width: `${reach.percent}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[11.5px] text-td-subtle font-semibold">{reach.missed ? `${reach.missed} did not open this week` : 'Every family looked this week'}</span>
            <ChevronRight />
          </div>
        </button>
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
        <div className="text-center text-td-muted text-sm py-8">No classes scheduled for today</div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-[26px] lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {schedule.map((c, i) => (
            <div key={`${c.time}${c.ampm}-${c.subject}-${c.klass}-${i}`} className="flex items-center gap-[13px] bg-td-card border border-td-border rounded-[18px] py-3.5 px-[15px]">
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
