'use client'

import { useDashboard, initials, type Screen } from '../store'
import { Icon, ink, type IconName } from './Icon'
import { LastUpdated } from './LastUpdated'

export function HomeScreen() {
  const { role, go, schedule, students, branchesList, googleEmail, myName, pendingStudents, staffList } = useDashboard()
  const isAdmin = role === 'admin'
  const pendingStaff = isAdmin ? staffList.filter(s => s.status === 'pending').length : 0
  const hasAlerts = pendingStudents.length > 0 || pendingStaff > 0
  const mainBranch = branchesList.find(b => b.main) ?? branchesList[0]
  const displayName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Admin' : 'Teacher')
  const ini = initials(displayName)

  // Home = the four quick daily shortcuts (same for head and teacher, clean
  // grid). Timetable is a bottom tab; Study material + all management (fees,
  // rankings, meetings, branches, subjects, reports, staff) live in More.
  const quickActions: { icon: IconName; label: string; tint: string; screen: Screen; tab?: string }[] = [
    { icon: 'attendance', label: 'Attendance', tint: '#e7f5ee', screen: 'attendance' },
    { icon: 'results', label: 'Results', tint: '#eaf1fc', screen: 'results' },
    { icon: 'homework', label: 'Assignment', tint: '#fcf3e3', screen: 'assign' },
    { icon: 'reminder', label: 'Reminder', tint: '#fdecea', screen: 'reminder' },
  ]

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => go('staffProfile')} aria-label="Open my profile" className="flex items-center gap-3 border-none bg-transparent p-0 cursor-pointer text-left">
          <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}>{ini}</div>
          <div>
            <div className="text-xs text-td-muted font-semibold">{isAdmin ? 'Head Teacher' : 'Teacher'}</div>
            <div className="text-[17px] font-extrabold text-td-dark">{displayName}</div>
          </div>
        </button>
        <button onClick={() => go('notifications', 'home')} aria-label="Notifications" className="relative w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          {hasAlerts && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-white" />}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-[18px]">
        {isAdmin ? (
          <button onClick={() => go('branches')} className="inline-flex items-center gap-[7px] bg-white border border-td-border rounded-[20px] py-[7px] px-[13px] cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
            <span className="text-[12.5px] font-semibold text-td-text">{mainBranch?.name ?? 'No branch'}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.4" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        ) : mainBranch ? (
          <div className="inline-flex items-center gap-[7px] bg-white border border-td-border rounded-[20px] py-[7px] px-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
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
        <div className="bg-white border border-td-border rounded-[18px] p-3.5">
          <div className="text-2xl font-extrabold leading-none text-td-dark">{students.length}</div>
          <div className="text-[12px] text-td-muted mt-1.5 font-semibold">Students</div>
        </div>
      </div>

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Quick actions</div>
      <div className="grid grid-cols-4 gap-2 mb-[26px] lg:max-w-2xl">
        {quickActions.map(a => (
          <button key={a.label} onClick={() => go(a.screen, (a.tab || 'home') as never)} className="border border-td-border bg-white rounded-[18px] py-3 px-0.5 cursor-pointer flex flex-col items-center gap-[7px]">
            <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center" style={{ background: a.tint, color: ink(a.tint) }}><Icon name={a.icon} size={21} /></div>
            <span className="text-[12px] font-bold text-td-text text-center leading-tight tracking-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Today&apos;s schedule</div>
      {schedule.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No classes scheduled for today</div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-[26px] lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {schedule.map((c) => (
            <div key={`${c.time}${c.ampm}-${c.subject}-${c.klass}`} className="flex items-center gap-[13px] bg-white border border-td-border rounded-[18px] py-3.5 px-[15px]">
              <div className="text-center shrink-0 w-[52px]">
                <div className="text-sm font-extrabold text-td-primary">{c.time}</div>
                <div className="text-[12px] text-td-subtle font-semibold">{c.ampm}</div>
              </div>
              <div className="w-px h-[34px] bg-[#eef1f7]" />
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
