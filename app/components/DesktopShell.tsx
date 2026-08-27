'use client'

import { useEffect, useState } from 'react'
import { useDashboard, initials, type Screen, type Tab } from '../store'
import { Icon, type IconName } from './Icon'

// Desktop breakpoint (lg). Starts false so SSR/hydration match the phone
// layout; the media query resolves during the auth-loading phase, well before
// any staff screen paints, so there is no visible flash on a laptop.
export function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return desktop
}

type NavItem = { icon: IconName; label: string; screen: Screen; tab?: Tab; active?: Screen[]; badge?: number }

function NavRow({ item }: { item: NavItem }) {
  const { screen, go } = useDashboard()
  const on = screen === item.screen || (item.active?.includes(screen) ?? false)
  return (
    <button
      onClick={() => go(item.screen, item.tab)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[13px] cursor-pointer transition-colors ${
        on ? 'bg-td-tint-blue text-td-primary' : 'text-td-text hover:bg-td-soft'
      }`}
    >
      <span className="w-[30px] h-[30px] rounded-[9px] bg-td-card border border-td-border flex items-center justify-center shrink-0"><Icon name={item.icon} size={17} /></span>
      <span className={`flex-1 text-[13.5px] ${on ? 'font-extrabold' : 'font-bold'}`}>{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className="text-[12px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{item.badge}</span>
      )}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] font-extrabold text-td-muted uppercase tracking-wide px-3 mt-5 mb-1.5">{children}</div>
}

function Sidebar() {
  const { role, go, signOut, centreName, centreLogo, myName, googleEmail, staffList, pendingStudents, loadMyCentre } = useDashboard()
  const isAdmin = role === 'admin'
  useEffect(() => { if (!centreName) loadMyCentre() }, [centreName, loadMyCentre])
  const name = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')
  const pending = staffList.filter(s => s.status === 'pending').length
  const stuReq = pendingStudents.length

  const main: NavItem[] = [
    { icon: 'home', label: 'Dashboard', screen: 'home', tab: 'home' },
    { icon: 'timetable', label: 'Timetable', screen: 'timetable', tab: 'timetable' },
    { icon: 'students', label: 'Students', screen: 'students', tab: 'students', active: ['addStudent', 'editStudent'] },
    ...(isAdmin ? [{ icon: 'staff' as IconName, label: 'Staff', screen: 'teachers' as Screen, tab: 'teachers' as Tab, active: ['addTeacher' as Screen] }] : []),
  ]
  const teaching: NavItem[] = [
    { icon: 'attendance', label: 'Attendance', screen: 'attendance' },
    { icon: 'results', label: 'Results', screen: 'results' },
    { icon: 'homework', label: 'Homework', screen: 'assign' },
    { icon: 'notes', label: 'Study material', screen: 'notes' },
    { icon: 'reminder', label: 'Reminders', screen: 'reminder' },
  ]
  const manage: NavItem[] = [
    { icon: 'approvals', label: 'Approvals', screen: 'staffApprovals', badge: pending },
    { icon: 'requests', label: 'Student requests', screen: 'studentRequests', badge: stuReq },
    { icon: 'reports', label: 'Reports', screen: 'reports' },
    { icon: 'fees', label: 'Fees', screen: 'fees' },
    { icon: 'rankings', label: 'Rankings', screen: 'rankings' },
    { icon: 'meetings', label: 'Meetings', screen: 'meetings' },
    { icon: 'branches', label: 'Branches', screen: 'branches' },
    { icon: 'subjects', label: 'Subjects', screen: 'subjects' },
    { icon: 'batches', label: 'Batches', screen: 'batches' },
  ]

  return (
    <aside className="w-[248px] shrink-0 h-[100dvh] sticky top-0 bg-td-card border-r border-td-border flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        {centreLogo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={centreLogo} alt={centreName || 'Centre'} className="w-9 h-9 rounded-[11px] object-cover shrink-0" />
          : <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white font-extrabold text-[15px] shrink-0" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>S</div>}
        <div className="min-w-0">
          <div className="text-[14.5px] font-extrabold text-td-dark truncate">{centreName || 'Second Skool'}</div>
          <div className="text-[12px] text-td-muted font-semibold">{isAdmin ? 'Head teacher' : 'Teacher'}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 pb-3">
        {main.map(i => <NavRow key={i.screen} item={i} />)}
        <SectionLabel>Teaching</SectionLabel>
        {teaching.map(i => <NavRow key={i.screen} item={i} />)}
        {isAdmin && (
          <>
            <SectionLabel>Management</SectionLabel>
            {manage.map(i => <NavRow key={i.screen} item={i} />)}
          </>
        )}
      </nav>

      <div className="border-t border-td-border p-3">
        <button onClick={() => go('staffProfile')} className="w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-[12px] hover:bg-td-soft cursor-pointer mb-1">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white font-bold text-[13px] shrink-0" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{initials(name)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold text-td-dark truncate">{name}</div>
            <div className="text-[12px] text-td-muted truncate">{googleEmail}</div>
          </div>
        </button>
        {/* On a phone this lives on More; the desktop shell has no More, so
            without this row a laptop user has no way to report anything. */}
        <NavRow item={{ icon: 'warning', label: 'Report a problem', screen: 'support' }} />
        <button onClick={signOut} className="w-full border border-td-edge-red bg-td-wash-red text-td-red text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer flex items-center justify-center gap-2 mt-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}

// Mirrors the phone toast in Shell.tsx — same error styling, same tap to
// dismiss, same reasons for both. See the comment there.
function DesktopToast() {
  const toast = useDashboard(s => s.toast)
  const kind = useDashboard(s => s.toastKind)
  const dismissToast = useDashboard(s => s.dismissToast)
  if (!toast) return null
  const err = kind === 'error'
  return (
    <div
      role={err ? 'alert' : 'status'}
      aria-live={err ? 'assertive' : 'polite'}
      className={`fixed left-1/2 -translate-x-1/2 bottom-8 max-w-[440px] rounded-[14px] text-white z-50 shadow-[0_14px_36px_rgba(0,0,0,.28)] animate-[toastIn_.25s_ease] ${err ? 'bg-[#8f2417]' : 'bg-td-dark'}`}
    >
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss message"
        className={`w-full flex items-start gap-2.5 py-3.5 px-5 cursor-pointer ${err ? 'text-left' : 'justify-center text-center'}`}
      >
        {err && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="shrink-0 mt-px" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" />
          </svg>
        )}
        <span className="text-sm font-semibold leading-snug">{toast}</span>
      </button>
    </div>
  )
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-td-soft">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto h-[100dvh]">
        <div className="max-w-[1180px] mx-auto w-full px-8 py-7 td-desktop">{children}</div>
      </main>
      <DesktopToast />
    </div>
  )
}

// Desktop shell for the pre-app screens (login / register / pending / denied).
// A split brand panel + a centered auth card, so a laptop never shows the tiny
// phone mockup floating in grey. The auth screens render unchanged inside.
const AUTH_FEATURES = [
  'Mark attendance & publish results in seconds',
  'Track fees and notify parents automatically',
  'Live rankings, reports and timetables — every branch',
]

export function DesktopAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] bg-td-card overflow-hidden">
      <aside className="hidden lg:flex flex-col justify-between w-[46%] max-w-[640px] p-14 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#2a6fdb 0%,#1f56ad 58%,#173f88 100%)' }}>
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-[-6rem] left-[-4rem] w-72 h-72 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="Second Skool" width={42} height={42} className="rounded-[12px] object-cover shadow-[0_2px_10px_rgba(0,0,0,.18)]" />
          <span className="text-[19px] font-extrabold tracking-tight">Second Skool</span>
        </div>

        <div className="relative">
          <h1 className="text-[38px] font-extrabold leading-[1.12] tracking-tight">Run your whole tuition centre from one screen.</h1>
          <p className="text-[15px] text-white/80 mt-5 max-w-[430px] leading-relaxed">Attendance, results, fees and parent updates — for every branch, every teacher, every student.</p>
          <ul className="mt-9 flex flex-col gap-[18px]">
            {AUTH_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-3.5">
                <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5"/></svg>
                </span>
                <span className="text-[14.5px] font-semibold text-white/95">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[12.5px] text-white/60">Built for tuition centres to stay organised every day.</div>
      </aside>

      <main className="flex-1 flex items-center justify-center overflow-y-auto h-[100dvh] bg-td-soft lg:bg-td-card px-5 py-8">
        <div className="w-full max-w-[440px] bg-td-card rounded-[28px] shadow-[0_18px_50px_-24px_rgba(20,30,60,.28)] lg:shadow-none lg:rounded-none">
          {children}
        </div>
      </main>
      <DesktopToast />
    </div>
  )
}
