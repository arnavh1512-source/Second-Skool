'use client'

import { useRef, useCallback } from 'react'
import { useDashboard, type Screen, type Tab } from '../store'

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    // Mobile: fills the screen (no bezel). md+: framed phone mockup.
    <div className="min-h-[var(--app-h)] w-full flex md:items-center md:justify-center md:bg-[#dfe4ee] md:p-10">
      <div className="w-full flex md:max-w-[402px] md:bg-[#0b0d12] md:rounded-[56px] md:p-[13px] md:shadow-[0_40px_90px_-20px_rgba(20,30,60,.45)]">
        <div className="relative w-full app-frame md:aspect-[376/812] bg-td-bg md:rounded-[44px] overflow-hidden flex flex-col">
          <StatusBar />
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pt-[env(safe-area-inset-top)] md:pt-0">{children}</div>
          <BottomTabBar />
          <Toast />
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    // Fake status bar is only for the desktop mockup; real phones have their own.
    <div className="hidden md:flex h-12 shrink-0 items-end justify-between px-7 pb-1.5 text-sm font-bold text-td-dark z-5">
      <span>9:41</span>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 w-[118px] h-[30px] bg-[#0b0d12] rounded-[18px]" />
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="7" width="3" height="5" rx="1" fill="#1a2332"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="#1a2332"/><rect x="9" y="2" width="3" height="10" rx="1" fill="#1a2332"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#1a2332"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="#1a2332" opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="1.5" fill="#1a2332"/><rect x="24" y="4" width="2" height="5" rx="1" fill="#1a2332" opacity="0.4"/></svg>
      </div>
    </div>
  )
}

function BottomTabBar() {
  const { role, tab, go, currentStudentDbId, staffStatus, supabaseUserId, pendingStudents, staffList } = useDashboard()
  if (!role) return null
  // Unapproved Google staff (register/pending/denied) get no navigation.
  if (supabaseUserId && staffStatus !== 'approved') return null

  if (role === 'student') {
    if (!currentStudentDbId) return null
    const color = (t: Tab) => tab === t ? '#2a6fdb' : '#9aa4b6'
    const stuTabs: { key: Tab; label: string; screen: Screen; icon: (c: string) => React.ReactNode }[] = [
      { key: 'stuHome', label: 'Home', screen: 'stuHome', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg> },
      { key: 'stuResults', label: 'Results', screen: 'stuResults', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V9"/><path d="M12 21V4"/><path d="M19 21v-7"/></svg> },
      { key: 'stuRanking', label: 'Ranking', screen: 'stuRanking', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg> },
      { key: 'stuTeachers', label: 'Teachers', screen: 'stuTeachers', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></svg> },
      { key: 'stuProfile', label: 'Profile', screen: 'stuProfile', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg> },
    ]
    return (
      <div className="shrink-0 flex justify-around items-center pt-3 px-2.5 bg-white border-t border-[#eef1f7] pb-[max(env(safe-area-inset-bottom),16px)] md:pb-[26px]">
        {stuTabs.map(t => (
          <button key={t.key} onClick={() => go(t.screen, t.key)} className="border-none bg-transparent cursor-pointer flex flex-col items-center gap-[5px] px-2.5 py-1">
            {t.icon(color(t.key))}
            <span className="text-[10.5px] font-bold" style={{ color: color(t.key) }}>{t.label}</span>
          </button>
        ))}
      </div>
    )
  }

  const color = (t: Tab) => tab === t ? '#2a6fdb' : '#9aa4b6'
  const allTabs: { key: Tab; label: string; headOnly?: boolean; icon: (c: string) => React.ReactNode }[] = [
    { key: 'home', label: 'Home', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg> },
    { key: 'timetable', label: 'Timetable', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg> },
    { key: 'students', label: 'Students', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13A4 4 0 0 1 16 11"/></svg> },
    { key: 'teachers', label: 'Staff', headOnly: true, icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg> },
    { key: 'more', label: 'More', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg> },
  ]
  const tabs = allTabs.filter(t => role === 'admin' || !t.headOnly)

  // Red dot on "More": something in that section needs the head/teacher's action —
  // a student self-registration waiting, or (head only) a staff access request.
  const pendingStaff = role === 'admin' ? staffList.filter(s => s.status === 'pending').length : 0
  const moreAlert = pendingStudents.length > 0 || pendingStaff > 0

  return (
    <div className="shrink-0 flex justify-around items-center pt-3 pb-[26px] px-2.5 bg-white border-t border-[#eef1f7]">
      {tabs.map(t => (
        <button key={t.key} onClick={() => go(t.key === 'timetable' ? 'timetable' : t.key as Screen, t.key)} className="border-none bg-transparent cursor-pointer flex flex-col items-center gap-[5px] px-2.5 py-1">
          <span className="relative">
            {t.icon(color(t.key))}
            {t.key === 'more' && moreAlert && (
              <span className="absolute -top-0.5 -right-1 w-[9px] h-[9px] rounded-full bg-td-red border-2 border-white" />
            )}
          </span>
          <span className="text-[10.5px] font-bold" style={{ color: color(t.key) }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

function Toast() {
  const toast = useDashboard(s => s.toast)
  if (!toast) return null
  return (
    // Every validation message in the app arrives here ("Enter your full name",
    // "Invalid code"). Without a live region a screen-reader user submitted the
    // form, heard nothing, and had no way to know why it did not go through.
    <div role="status" aria-live="polite" className="absolute left-5 right-5 bottom-[104px] bg-td-dark text-white py-3.5 px-4 rounded-[14px] text-[13.5px] font-semibold text-center z-30 shadow-[0_14px_36px_rgba(0,0,0,.28)] animate-[toastIn_.25s_ease]">
      {toast}
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
  )
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-[18px]">
      <div className="flex items-center gap-3.5">
        <BackButton onClick={onBack} />
        <div className="text-xl font-extrabold text-td-dark">{title}</div>
      </div>
      {right}
    </div>
  )
}

export function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const busy = useRef(false)
  const guard = useCallback(() => {
    if (busy.current) return
    busy.current = true
    onClick()
    setTimeout(() => { busy.current = false }, 800)
  }, [onClick])
  return (
    <button onClick={guard} className="w-full border-none bg-td-primary text-white text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer">
      {children}
    </button>
  )
}

export function ChevronRight() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
}
