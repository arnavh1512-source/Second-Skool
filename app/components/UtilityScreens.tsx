'use client'

import { useState, useEffect, useRef } from 'react'
import { useDashboard, REMINDER_TEMPLATES, initials, av, feeColor, type Screen } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight } from './Shell'
import { enablePush, pushSupported } from '../lib/push'
import { fileToLogoDataUrl } from '../lib/image'

export function FeesScreen() {
  const { students, back, notify, addFee, toggleFeeStatus, saveReminder } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [selStudent, setSelStudent] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState('')
  const [dueDate, setDueDate] = useState('')
  const paidCount = students.filter(s => s.feeStatus === 'Paid').length
  const pendingCount = students.filter(s => s.feeStatus !== 'Paid').length
  const rows = [...students.filter(d => d.feeStatus !== 'Paid'), ...students.filter(d => d.feeStatus === 'Paid')]

  const handleAdd = () => {
    if (!selStudent) { notify('Select a student'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { notify('Enter a valid amount'); return }
    if (!period.trim()) { notify('Enter the fee period'); return }
    if (!dueDate) { notify('Select a due date'); return }
    addFee(selStudent, amt, period.trim(), dueDate)
    setSelStudent(''); setAmount(''); setPeriod(''); setDueDate(''); setShowForm(false)
  }

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Fees" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add fee'}
        </button>
      } />

      <div className="flex gap-2.5 mb-[18px] lg:max-w-md">
        <div className="flex-1 bg-[#e7f5ee] rounded-2xl p-3.5">
          <div className="text-[22px] font-extrabold text-td-green">{paidCount}</div>
          <div className="text-[11px] text-[#5a8a72] font-semibold mt-[3px]">Paid</div>
        </div>
        <div className="flex-1 bg-[#fdecea] rounded-2xl p-3.5">
          <div className="text-[22px] font-extrabold text-td-red">{pendingCount}</div>
          <div className="text-[11px] text-[#a35545] font-semibold mt-[3px]">Pending</div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5 lg:max-w-lg">
          <div className="text-sm font-extrabold text-td-dark">Add fee record</div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Student</label>
            <select value={selStudent} onChange={e => setSelStudent(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              <option value="">Select student</option>
              {students.map(s => <option key={s.dbId ?? s.id} value={s.dbId ?? ''}>{s.name} — {s.klass}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Amount (&#8377;)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 5000" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Period</label>
              <input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. July 2026" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Due date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <PrimaryButton onClick={handleAdd}>Add fee record</PrimaryButton>
        </div>
      )}

      <button onClick={() => { if (pendingCount === 0) { notify('No pending fees'); return } saveReminder('Fee', REMINDER_TEMPLATES.Fee, 'all', 'fees_due') }} className="w-full lg:max-w-md border border-td-red bg-white text-td-red text-sm font-extrabold p-[13px] rounded-[14px] cursor-pointer mb-[18px]">Send alert to all pending</button>

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No students added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {rows.map(d => {
            const realIdx = students.findIndex(s => s.id === d.id)
            const f = feeColor(d.feeStatus)
            return (
              <div key={d.id} className="bg-white border border-td-border rounded-2xl p-[13px] px-3.5 flex items-center gap-[13px]">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(realIdx) }}>{initials(d.name)}</div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold text-td-dark">{d.name}</div>
                  <div className="text-xs text-td-muted mt-0.5">{d.klass}</div>
                </div>
                <button onClick={() => toggleFeeStatus(realIdx)} className="text-[10.5px] font-bold py-[5px] px-2.5 rounded-[20px] border-none cursor-pointer" style={{ color: f.c, background: f.b }}>{d.feeStatus}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MeetingsScreen() {
  const { back, meetingsList, saveMeeting } = useDashboard()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Parent-teacher meeting')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('11:00 AM')

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Meetings" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[22px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Schedule new</div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Parent-teacher meeting" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
            <option>Parent-teacher meeting</option><option>Staff meeting</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Time</label><input value={time} onChange={e => setTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        </div>
        <PrimaryButton onClick={() => { saveMeeting(title, type, date, time); setTitle(''); setDate('') }}>Schedule &amp; invite</PrimaryButton>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">Upcoming</div>
      {meetingsList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-4">No meetings scheduled</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetingsList.map(m => (
            <div key={m.title + m.day} className="bg-white border border-td-border rounded-2xl p-3.5 flex items-center gap-[13px]">
              <div className="w-[46px] text-center shrink-0 bg-[#eaf1fc] rounded-xl py-2">
                <div className="text-base font-extrabold text-td-primary leading-none">{m.day}</div>
                <div className="text-[10px] text-td-primary font-semibold mt-0.5">{m.mon}</div>
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{m.title}</div>
                <div className="text-xs text-td-muted mt-0.5">{m.time} · {m.kind}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RankingsScreen() {
  const { rankSubject, rankData, subjects, back, set, go } = useDashboard()
  const subjectNames = subjects.map(s => s.name)
  const rows = (rankData[rankSubject] || []).map((r, i) => ({ rank: i + 1, name: r[0], score: r[1] }))

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Rankings" onBack={back} />

      {subjectNames.length === 0 && (
        <button onClick={() => go('subjects', 'more')} className="w-full text-left bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3.5 cursor-pointer text-[12.5px] text-td-primary font-semibold">Add subjects first (More → Subjects) so rankings can be grouped by subject.</button>
      )}

      <div className="flex gap-[9px] overflow-x-auto mb-[18px] scrollbar-hide">
        {subjectNames.map(name => {
          const active = name === rankSubject
          return (
            <button key={name} onClick={() => set({ rankSubject: name })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">{rankSubject ? `No results entered for ${rankSubject} yet` : 'Enter results to generate rankings'}</div>
      ) : (
        <div className="flex flex-col gap-[9px] mb-5">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-[13px] bg-white border border-td-border rounded-2xl p-3 px-3.5">
              <div className="w-[26px] text-center text-sm font-extrabold" style={{ color: i < 3 ? '#e0962f' : '#9aa4b6' }}>{r.rank}</div>
              <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(r.name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}</div>
              <div className="text-sm font-extrabold text-td-dark">{r.score}%</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5 bg-[#eaf1fc] border border-[#dbe6fa] rounded-[14px] p-3.5 mt-1">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
        <span className="text-[12.5px] text-td-primary font-semibold">Rankings update automatically — students always see the latest.</span>
      </div>
    </div>
  )
}

export function BranchesScreen() {
  const { back, branchesList, addBranch, deleteBranch } = useDashboard()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [isMain, setIsMain] = useState(false)

  const handleAdd = () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter branch name'); return }
    addBranch(name.trim(), address.trim(), isMain)
    setName(''); setAddress(''); setIsMain(false); setShowForm(false)
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Branches" onBack={back} right={
        <button onClick={() => setShowForm(f => !f)} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      } />

      {showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
          <div className="text-sm font-extrabold text-td-dark">New branch</div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Satellite Centre" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 123 Main Street" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isMain} onChange={e => setIsMain(e.target.checked)} className="w-5 h-5 accent-[#2a6fdb] rounded" />
            <span className="text-[13px] font-bold text-td-dark">Set as main branch</span>
          </label>
          <PrimaryButton onClick={handleAdd}>Add branch</PrimaryButton>
        </div>
      )}

      {branchesList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No branches configured</div>
      ) : (
        <div className="flex flex-col gap-3">
          {branchesList.map(b => (
            <div key={b.name} className="bg-white border border-td-border rounded-[18px] p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[15px] font-extrabold text-td-dark">{b.name}</div>
                {b.main && <span className="text-[10px] font-bold text-td-primary bg-[#eaf1fc] py-1 px-[9px] rounded-[20px]">Main</span>}
              </div>
              <div className="text-[12.5px] text-td-muted mb-3">{b.address}</div>
              <div className="flex items-center justify-between">
                <div className="flex gap-[18px]">
                  <div><div className="text-base font-extrabold text-td-dark">{b.students}</div><div className="text-[11px] text-td-subtle font-semibold">Students</div></div>
                  <div><div className="text-base font-extrabold text-td-dark">{b.staff}</div><div className="text-[11px] text-td-subtle font-semibold">Staff</div></div>
                </div>
                {b.dbId && <button onClick={() => deleteBranch(b.dbId!)} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-2 px-3.5 rounded-[12px] cursor-pointer">Remove</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SubjectsScreen() {
  const { subjects, back, addSubject, deleteSubject } = useDashboard()
  const [name, setName] = useState('')

  const handleAdd = () => {
    if (!name.trim()) { useDashboard.getState().notify('Enter subject name'); return }
    addSubject(name.trim())
    setName('')
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Subjects" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5">
        <div className="text-sm font-extrabold text-td-dark">Add subject</div>
        <div className="flex gap-[11px]">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" className="flex-1 border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="border-none bg-td-primary text-white text-sm font-bold py-[13px] px-5 rounded-[14px] cursor-pointer shrink-0">Add</button>
        </div>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">All subjects ({subjects.length})</div>
      {subjects.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No subjects added yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {subjects.map((s, i) => (
            <div key={s.name} className="bg-white border border-td-border rounded-2xl p-[13px] px-[15px] flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[14px]" style={{ background: av(i) }}>{s.name[0]}</div>
              <div className="flex-1 text-[14px] font-bold text-td-dark">{s.name}</div>
              {s.dbId && <button onClick={() => { if (window.confirm(`Remove "${s.name}" everywhere? Its tests, results and timetable periods will be deleted too.`)) deleteSubject(s.dbId!) }} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] font-bold py-1.5 px-3 rounded-[11px] cursor-pointer">Remove</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type MoreItem = { icon: string; label: string; tint: string; screen: Screen; badge?: number }

export function MoreScreen() {
  const { go, signOut, role, myName, googleEmail, staffList, loadStaff } = useDashboard()
  const isAdmin = role === 'admin'
  const profileName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  // Head: keep the approvals badge fresh (Admin Dashboard now lives here).
  useEffect(() => { if (isAdmin) loadStaff() }, [isAdmin, loadStaff])
  const pendingCount = staffList.filter(s => s.status === 'pending').length

  const daily: MoreItem[] = [
    { icon: '✅', label: 'Mark attendance', tint: '#e7f5ee', screen: 'attendance' },
    { icon: '📊', label: 'Enter results', tint: '#eaf1fc', screen: 'results' },
    { icon: '📚', label: 'Assignments', tint: '#fcf3e3', screen: 'assign' },
    { icon: '📄', label: 'Study material', tint: '#eef0fc', screen: 'notes' },
    { icon: '🔔', label: 'Send reminders', tint: '#fdecea', screen: 'reminder' },
  ]
  const management: MoreItem[] = [
    { icon: '🛡️', label: 'Staff access & approvals', tint: '#eef0fc', screen: 'staffApprovals', badge: pendingCount },
    { icon: '📈', label: 'Weekly report', tint: '#e7f5ee', screen: 'reports' },
    { icon: '💳', label: 'Fees & alerts', tint: '#e7f5ee', screen: 'fees' },
    { icon: '🏆', label: 'Rankings', tint: '#fcf3e3', screen: 'rankings' },
    { icon: '📅', label: 'Meetings', tint: '#eaf1fc', screen: 'meetings' },
    { icon: '🏢', label: 'Branches', tint: '#eef0fc', screen: 'branches' },
    { icon: '📖', label: 'Subjects', tint: '#eaf1fc', screen: 'subjects' },
  ]

  const card = (list: MoreItem[]) => (
    <div className="bg-white border border-td-border rounded-[20px] overflow-hidden">
      {list.map(m => (
        <button key={m.label} onClick={() => go(m.screen, 'more')} className="w-full text-left border-none bg-transparent border-b border-[#f0f2f7] p-[15px] px-[17px] flex items-center gap-3.5 cursor-pointer last:border-b-0">
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg" style={{ background: m.tint }}>{m.icon}</div>
          <div className="flex-1 text-sm font-bold text-td-dark">{m.label}</div>
          {!!m.badge && m.badge > 0 && <span className="text-[11px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{m.badge}</span>}
          <ChevronRight />
        </button>
      ))}
    </div>
  )

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-[18px]">More tools</div>

      <button onClick={() => go('staffProfile', 'more')} className="w-full text-left bg-white border border-td-border rounded-[20px] p-3.5 flex items-center gap-3.5 cursor-pointer mb-4">
        <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center text-white font-bold text-[15px]" style={{ background: av(0) }}>{initials(profileName)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-td-dark truncate">{profileName}</div>
          <div className="text-xs text-td-muted mt-0.5 truncate">{googleEmail} · {isAdmin ? 'Head teacher' : 'Teacher'}</div>
        </div>
        <ChevronRight />
      </button>

      {card(daily)}

      {isAdmin && (
        <>
          <div className="text-[13px] font-extrabold text-td-muted mt-5 mb-[11px] px-1">Management</div>
          {card(management)}
        </>
      )}

      <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-4 flex items-center justify-center gap-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>
  )
}

export function StaffProfileScreen() {
  const { go, role, myName, myPhone, googleEmail, saveStaffProfile, signOut, centreName, centreLogo, loadMyCentre, renameCentre, saveCentreLogo, supabaseUserId, notify } = useDashboard()
  const isAdmin = role === 'admin'
  const logoInput = useRef<HTMLInputElement>(null)
  const [logoBusy, setLogoBusy] = useState(false)
  const pickLogo = async (file?: File) => {
    if (!file) return
    setLogoBusy(true)
    try { await saveCentreLogo(await fileToLogoDataUrl(file)) }
    catch (e) { notify(e instanceof Error ? e.message : 'Could not use that image') }
    finally { setLogoBusy(false); if (logoInput.current) logoInput.current.value = '' }
  }
  const [pushOn, setPushOn] = useState(false)
  const enableNotifs = async () => {
    if (!supabaseUserId) return
    const res = await enablePush('profile', supabaseUserId)
    if (res.ok) { setPushOn(true); notify('Notifications on for this device') }
    else notify(res.error || 'Could not enable')
  }
  const [name, setName] = useState(myName)
  const [phone, setPhone] = useState(myPhone)
  const [centre, setCentre] = useState(centreName)
  const [busy, setBusy] = useState(false)
  const displayName = name || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  useEffect(() => { if (isAdmin && !centreName) loadMyCentre() }, [isAdmin, centreName, loadMyCentre])

  // Sync the input when the centre name arrives (adjust-during-render pattern).
  const [prevCentreName, setPrevCentreName] = useState(centreName)
  if (centreName !== prevCentreName) { setPrevCentreName(centreName); setCentre(centreName) }

  const save = async () => {
    setBusy(true)
    await saveStaffProfile(name, phone)
    if (isAdmin && centre.trim() && centre.trim() !== centreName) await renameCentre(centre)
    setBusy(false)
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="My Profile" onBack={() => go('more', 'more')} />

      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-[76px] h-[76px] rounded-[24px] flex items-center justify-center text-white font-extrabold text-[26px] mb-3" style={{ background: av(0) }}>{initials(displayName)}</div>
        <div className="text-[18px] font-extrabold text-td-dark">{displayName}</div>
        <div className="text-[12.5px] text-td-muted mt-0.5">{googleEmail}</div>
        <div className="inline-flex items-center gap-[6px] bg-[#e7f5ee] rounded-[20px] py-[5px] px-[11px] mt-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-td-green" />
          <span className="text-[11px] font-bold text-td-green">{isAdmin ? 'Head teacher' : 'Teacher'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        {isAdmin && (
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Centre name</label><input value={centre} onChange={e => setCentre(e.target.value)} placeholder="e.g. Bright Future Tuition" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        )}
        {isAdmin && (
          <div>
            <label className="text-xs font-bold text-td-muted mb-[7px] block">Centre logo</label>
            <div className="flex items-center gap-3.5 border border-td-border rounded-[14px] p-3">
              <div className="w-14 h-14 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center bg-[#f4f6fb] border border-td-border">
                {centreLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={centreLogo} alt="Centre logo" className="w-full h-full object-cover" />
                  : <span className="font-extrabold text-td-primary text-xl">{initials(centre || centreName || 'S')}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <button onClick={() => logoInput.current?.click()} disabled={logoBusy} className="border border-td-border bg-white text-td-dark text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer disabled:opacity-60">{logoBusy ? 'Uploading…' : centreLogo ? 'Change' : 'Upload'}</button>
                  {centreLogo && !logoBusy && (
                    <button onClick={() => saveCentreLogo('')} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer">Remove</button>
                  )}
                </div>
                <p className="text-[11.5px] text-td-muted mt-1.5 leading-snug">Students who log in with your centre code see this logo.</p>
              </div>
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 bg-[#f4f6fb] border border-[#e6eaf2] rounded-[14px] p-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa4b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span className="text-[12px] text-td-muted">Your email is managed by Google and can&apos;t be changed here.</span>
        </div>
      </div>

      <PrimaryButton onClick={busy ? () => {} : save}>{busy ? 'Saving…' : 'Save changes'}</PrimaryButton>

      {pushSupported() && (
        <button onClick={enableNotifs} disabled={pushOn} className="w-full border border-td-border bg-white text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2 disabled:opacity-60">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          {pushOn ? 'Notifications enabled' : 'Enable notifications'}
        </button>
      )}

      <button onClick={signOut} className="w-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-[9px]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8553c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
        Sign out
      </button>
    </div>
  )
}

