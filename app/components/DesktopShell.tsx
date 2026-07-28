'use client'

import { useEffect, useState } from 'react'
import { useDashboard, initials, type Screen, type Tab } from '../store'

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

type NavItem = { icon: string; label: string; screen: Screen; tab?: Tab; active?: Screen[]; badge?: number }

function NavRow({ item }: { item: NavItem }) {
  const { screen, go } = useDashboard()
  const on = screen === item.screen || (item.active?.includes(screen) ?? false)
  return (
    <button
      onClick={() => go(item.screen, item.tab)}
      className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-[13px] cursor-pointer transition-colors ${
        on ? 'bg-[#eaf1fc] text-td-primary' : 'text-td-text hover:bg-[#f4f6fb]'
      }`}
    >
      <span className="w-[30px] h-[30px] rounded-[9px] bg-white border border-td-border flex items-center justify-center text-[15px] shrink-0">{item.icon}</span>
      <span className={`flex-1 text-[13.5px] ${on ? 'font-extrabold' : 'font-bold'}`}>{item.label}</span>
      {!!item.badge && item.badge > 0 && (
        <span className="text-[11px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{item.badge}</span>
      )}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-extrabold text-td-muted uppercase tracking-wide px-3 mt-5 mb-1.5">{children}</div>
}

function Sidebar() {
  const { role, go, signOut, centreName, myName, googleEmail, staffList } = useDashboard()
  const isAdmin = role === 'admin'
  const name = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')
  const pending = staffList.filter(s => s.status === 'pending').length

  const main: NavItem[] = [
    { icon: '🏠', label: 'Dashboard', screen: 'home', tab: 'home' },
    { icon: '📅', label: 'Timetable', screen: 'timetable', tab: 'timetable' },
    { icon: '👥', label: 'Students', screen: 'students', tab: 'students', active: ['addStudent', 'editStudent'] },
    ...(isAdmin ? [{ icon: '🧑‍🏫', label: 'Staff', screen: 'teachers' as Screen, tab: 'teachers' as Tab, active: ['addTeacher' as Screen] }] : []),
  ]
  const teaching: NavItem[] = [
    { icon: '✅', label: 'Attendance', screen: 'attendance' },
    { icon: '📊', label: 'Results', screen: 'results' },
    { icon: '📚', label: 'Homework', screen: 'assign' },
    { icon: '📄', label: 'Study material', screen: 'notes' },
    { icon: '🔔', label: 'Reminders', screen: 'reminder' },
  ]
  const manage: NavItem[] = [
    { icon: '🛡️', label: 'Approvals', screen: 'staffApprovals', badge: pending },
    { icon: '📈', label: 'Reports', screen: 'reports' },
    { icon: '💳', label: 'Fees', screen: 'fees' },
    { icon: '🏆', label: 'Rankings', screen: 'rankings' },
    { icon: '📆', label: 'Meetings', screen: 'meetings' },
    { icon: '🏢', label: 'Branches', screen: 'branches' },
    { icon: '📖', label: 'Subjects', screen: 'subjects' },
  ]

  return (
    <aside className="w-[248px] shrink-0 h-[100dvh] sticky top-0 bg-white border-r border-td-border flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white font-extrabold text-[15px]" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>S</div>
        <div className="min-w-0">
          <div className="text-[14.5px] font-extrabold text-td-dark truncate">{centreName || 'Second Skool'}</div>
          <div className="text-[11px] text-td-muted font-semibold">{isAdmin ? 'Head teacher' : 'Teacher'}</div>
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
        <button onClick={() => go('staffProfile')} className="w-full text-left flex items-center gap-2.5 px-2 py-2 rounded-[12px] hover:bg-[#f4f6fb] cursor-pointer mb-1">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-white font-bold text-[13px] shrink-0" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{initials(name)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold text-td-dark truncate">{name}</div>
            <div className="text-[11px] text-td-muted truncate">{googleEmail}</div>
          </div>
        </button>
        <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[13px] font-extrabold py-2.5 rounded-[12px] cursor-pointer flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}

function DesktopToast() {
  const toast = useDashboard(s => s.toast)
  if (!toast) return null
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-8 bg-td-dark text-white py-3.5 px-5 rounded-[14px] text-sm font-semibold text-center z-50 shadow-[0_14px_36px_rgba(0,0,0,.28)] animate-[toastIn_.25s_ease]">
      {toast}
    </div>
  )
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-[#f6f8fc]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto h-[100dvh]">
        <div className="max-w-[1180px] mx-auto w-full px-8 py-7 td-desktop">{children}</div>
      </main>
      <DesktopToast />
    </div>
  )
}
