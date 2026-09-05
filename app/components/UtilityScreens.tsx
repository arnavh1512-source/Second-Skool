'use client'

import { useState, useEffect, useRef } from 'react'
import { useBusy } from '../lib/use-busy'
import { useDashboard, initials, av, MIN_PASSWORD_LENGTH, type Screen } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight, EmptyState, ConfirmDialog, Chip } from './Shell'
import { Icon, ink, type IconName } from './Icon'
import { enablePush, pushSupported, testNotification } from '../lib/push'
import { fileToLogoDataUrl } from '../lib/image'

// Both staff screens below offer the same device toggle. It keeps its own
// state rather than the store's: whether push is on is a fact about this
// browser on this phone, not about the account.
function EnablePushButton() {
  const { supabaseUserId, notify } = useDashboard()
  const [on, setOn] = useState(false)
  const [busy, run] = useBusy()
  const turnOn = () => run(async () => {
    if (!supabaseUserId) return
    const res = await enablePush('profile', supabaseUserId)
    if (!res.ok) { notify(res.error || 'Could not enable'); return }
    setOn(true)
    // Prove the device can actually show one, rather than leaving the head to
    // discover days later that the phone was silently blocking them.
    const t = await testNotification(useDashboard.getState().centreName)
    notify(t.ok ? 'Notifications on — check for a test alert' : (t.error || 'Notifications on for this device'))
  })

  if (!pushSupported()) return null
  return (
    <button onClick={turnOn} disabled={on || busy} className="w-full border border-td-border bg-td-card text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2 disabled:opacity-60">
      <Icon name="reminder" size={17} color="var(--color-td-primary)" />
      {on ? 'Notifications enabled' : busy ? 'Enabling…' : 'Enable notifications on this device'}
    </button>
  )
}

export function MeetingsScreen() {
  const { back, meetingsList, saveMeeting, deleteMeeting, role } = useDashboard()
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Parent-teacher meeting')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('11:00 AM')
  const [confirmCancel, setConfirmCancel] = useState<{ id: string; title: string } | null>(null)
  // Only the head can delete a meeting — meetings_head is the policy that
  // permits it, and a button a teacher can press but RLS will refuse is worse
  // than no button at all.
  const isAdmin = role === 'admin'

  return (
    <div className="td-screen">
      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel this meeting?"
        body={`"${confirmCancel?.title ?? ''}" is removed from every parent's home screen. They are not told it was cancelled, so let them know yourself.`}
        confirmLabel="Cancel meeting"
        onConfirm={() => { const t = confirmCancel; setConfirmCancel(null); if (t) deleteMeeting(t.id) }}
        onCancel={() => setConfirmCancel(null)}
      />
      <ScreenHeader title="Meetings" onBack={back} />

      <div className="td-form-card mb-[22px]">
        <div className="text-sm td-strong">Schedule new</div>
        <div><label className="td-label">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Parent-teacher meeting" className="td-field text-sm" /></div>
        <div><label className="td-label">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="td-field text-[13.5px] bg-td-card">
            <option>Parent-teacher meeting</option><option>Staff meeting</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="td-label">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="td-field text-sm" /></div>
          <div><label className="td-label">Time</label><input value={time} onChange={e => setTime(e.target.value)} className="td-field text-sm" /></div>
        </div>
        <PrimaryButton onClick={async () => { if (await saveMeeting(title, type, date, time)) { setTitle(''); setDate('') } }}>Schedule &amp; invite</PrimaryButton>
      </div>

      <div className="td-h2">All meetings</div>
      {meetingsList.length === 0 ? (
        <EmptyState title="No meetings scheduled" hint="Use the form above to add one — it will appear here and on the home screen." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {meetingsList.map((m, i) => (
            <div key={m.dbId ?? `${m.title}-${m.day}-${i}`} className="td-card rounded-2xl p-3.5 flex items-center gap-[13px]">
              <div className="w-[46px] text-center shrink-0 bg-td-tint-blue rounded-xl py-2">
                <div className="text-base font-extrabold text-td-primary leading-none">{m.day}</div>
                <div className="text-[12px] text-td-primary font-semibold mt-0.5">{m.mon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-td-dark">{m.title}</div>
                <div className="text-xs text-td-muted mt-0.5">{m.time} · {m.kind}</div>
              </div>
              {isAdmin && m.dbId && (
                <button onClick={() => setConfirmCancel({ id: m.dbId!, title: m.title })} className="shrink-0 td-danger text-[12px] font-bold py-1.5 px-3 rounded-[11px]">Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RankingsScreen() {
  const { rankSubject, rankClass, rankData, subjects, back, set, go } = useDashboard()
  // Only subjects that actually have a board. A centre teaches Physics to
  // Class 12 alone, so a Physics chip on a screen filtered to Class 9 is a chip
  // that can never have rows behind it — offering it is a promise of an empty
  // screen. Ordered by the centre's own subject list so the chips do not
  // reshuffle when a new result lands.
  const subjectNames = subjects.map(s => s.name).filter(n => (rankData[n]?.length ?? 0) > 0)
  const activeSubject = subjectNames.includes(rankSubject) ? rankSubject : (subjectNames[0] ?? '')
  const board = rankData[activeSubject] || []
  // A rank only means something against the same paper. Class 9 and Class 12
  // sit different tests out of different totals, so one list of everyone is
  // noise. Boards built before the class reached the server carry no class at
  // all, and those still render whole rather than as an empty screen.
  const classNames = [...new Set(board.map(r => r.klass).filter((k): k is string => !!k))]
  const activeClass = classNames.includes(rankClass) ? rankClass : (classNames[0] ?? '')
  const rows = activeClass ? board.filter(r => r.klass === activeClass) : board

  return (
    <div className="td-screen">
      <ScreenHeader title="Rankings" onBack={back} />

      {subjects.length === 0 && (
        <button onClick={() => go('subjects', 'more')} className="w-full text-left bg-td-tint-blue border border-td-edge-blue rounded-[14px] p-3.5 cursor-pointer text-[12.5px] text-td-primary font-semibold">Add subjects first (More → Subjects) so rankings can be grouped by subject.</button>
      )}

      {subjectNames.length > 0 && (
        <div className={`flex gap-[9px] overflow-x-auto scrollbar-hide ${classNames.length > 1 ? 'mb-[9px]' : 'mb-[18px]'}`}>
          {subjectNames.map(name => (
            <Chip key={name} active={name === activeSubject} onClick={() => set({ rankSubject: name })}>{name}</Chip>
          ))}
        </div>
      )}

      {classNames.length > 1 && (
        <div className="flex gap-[9px] overflow-x-auto mb-[18px] scrollbar-hide">
          {classNames.map(name => (
            <Chip key={name} active={name === activeClass} onClick={() => set({ rankClass: name })}>{name}</Chip>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="td-none">Enter results to generate rankings</div>
      ) : (
        <div className="flex flex-col gap-[9px] mb-5">
          {rows.map((r, i) => (
            <div key={r.id ?? `${r.name}-${i}`} className="flex items-center gap-[13px] td-card rounded-2xl p-3 px-3.5">
              <div className="w-[26px] text-center text-sm font-extrabold" style={{ color: i < 3 ? 'var(--color-td-amber)' : 'var(--color-td-subtle)' }}>{i + 1}</div>
              <div className="w-9 h-9 rounded-[11px] td-avatar" style={{ background: av(i) }}>{initials(r.name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}</div>
              <div className="text-sm td-strong">{r.score}%</div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2.5 bg-td-tint-blue border border-td-edge-blue rounded-[14px] p-3.5 mt-1">
        <Icon name="info" size={18} color="var(--color-td-primary)" />
        <span className="text-[12.5px] text-td-primary font-semibold">Rankings update automatically — students always see the latest.</span>
      </div>
    </div>
  )
}

type MoreItem = { icon: IconName; label: string; tint: string; screen: Screen; badge?: number }

export function MoreScreen() {
  const { goFrom, signOut, role, myName, googleEmail, staffList, loadStaff, pendingStudents, studentDevices } = useDashboard()
  const isAdmin = role === 'admin'
  const profileName = myName || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  // Head: keep the approvals badge fresh (Admin Dashboard now lives here).
  useEffect(() => { if (isAdmin) loadStaff() }, [isAdmin, loadStaff])
  const pendingCount = staffList.filter(s => s.status === 'pending').length
  // Both live on the Student requests screen, so one badge counts both.
  const studentRequestCount = pendingStudents.length + studentDevices.filter(d => !d.allowed).length

  const daily: MoreItem[] = [
    { icon: 'requests', label: 'Student requests', tint: 'var(--color-td-tint-green)', screen: 'studentRequests', badge: studentRequestCount },
    { icon: 'attendance', label: 'Mark attendance', tint: 'var(--color-td-tint-green)', screen: 'attendance' },
    { icon: 'results', label: 'Enter results', tint: 'var(--color-td-tint-blue)', screen: 'results' },
    { icon: 'homework', label: 'Assignments', tint: 'var(--color-td-tint-amber)', screen: 'assign' },
    { icon: 'notes', label: 'Study material', tint: 'var(--color-td-tint-indigo)', screen: 'notes' },
    { icon: 'reminder', label: 'Send reminders', tint: 'var(--color-td-tint-red)', screen: 'reminder' },
  ]
  const management: MoreItem[] = [
    { icon: 'approvals', label: 'Staff access & approvals', tint: 'var(--color-td-tint-indigo)', screen: 'staffApprovals', badge: pendingCount },
    { icon: 'reports', label: 'Weekly report', tint: 'var(--color-td-tint-green)', screen: 'reports' },
    { icon: 'fees', label: 'Fees & alerts', tint: 'var(--color-td-tint-green)', screen: 'fees' },
    { icon: 'rankings', label: 'Rankings', tint: 'var(--color-td-tint-amber)', screen: 'rankings' },
    { icon: 'meetings', label: 'Meetings', tint: 'var(--color-td-tint-blue)', screen: 'meetings' },
    { icon: 'branches', label: 'Branches', tint: 'var(--color-td-tint-indigo)', screen: 'branches' },
    { icon: 'subjects', label: 'Subjects', tint: 'var(--color-td-tint-blue)', screen: 'subjects' },
    { icon: 'batches', label: 'Batches', tint: 'var(--color-td-tint-green)', screen: 'batches' },
  ]

  const card = (list: MoreItem[]) => (
    <div className="td-card rounded-[20px] overflow-hidden">
      {list.map(m => (
        <button key={m.label} onClick={() => goFrom(m.screen, 'more', 'more')} className="td-plain w-full text-left border-b border-td-line p-[15px] px-[17px] flex items-center gap-3.5 cursor-pointer last:border-b-0">
          <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: m.tint, color: ink(m.tint) }}><Icon name={m.icon} size={20} /></div>
          <div className="flex-1 text-sm font-bold text-td-dark">{m.label}</div>
          {!!m.badge && m.badge > 0 && <span className="text-[12px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{m.badge}</span>}
          <ChevronRight />
        </button>
      ))}
    </div>
  )

  return (
    <div className="td-screen">
      <div className="text-2xl td-strong mt-1.5 mb-[18px]">More tools</div>

      <button onClick={() => goFrom('staffProfile', 'more', 'more')} className="w-full text-left td-card rounded-[20px] p-3.5 flex items-center gap-3.5 cursor-pointer mb-4">
        <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center text-white font-bold text-[15px]" style={{ background: av(0) }}>{initials(profileName)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm td-strong truncate">{profileName}</div>
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


      <div className="mt-4">
        {card([{ icon: 'warning', label: 'Report a problem', tint: 'var(--color-td-tint-red)', screen: 'support' }])}
      </div>

      <button onClick={signOut} className="w-full td-danger text-sm font-extrabold p-[15px] rounded-2xl mt-4 flex items-center justify-center gap-[9px]">
        <Icon name="signOut" size={17} color="var(--color-td-red)" />
        Sign out
      </button>
    </div>
  )
}

// Head/teacher notifications: the actionable items that need attention —
// student self-registration requests, and (head only) staff access requests —
// plus a device push toggle. Mirrors the student notifications bell.
export function NotificationsScreen() {
  const { go, role, pendingStudents, staffList, loadStaff, refreshData } = useDashboard()
  const isAdmin = role === 'admin'

  // Pull fresh counts on open so the list reflects reality, not stale state.
  useEffect(() => { refreshData(); if (isAdmin) loadStaff() }, [refreshData, loadStaff, isAdmin])

  const studentCount = pendingStudents.length
  const staffCount = isAdmin ? staffList.filter(s => s.status === 'pending').length : 0
  const empty = studentCount === 0 && staffCount === 0

  const row = (icon: IconName, tint: string, label: string, count: number, screen: Screen) => (
    <button onClick={() => go(screen, 'home')} className="w-full text-left border-none td-card rounded-[18px] p-4 flex items-center gap-3.5 cursor-pointer mb-2.5">
      <div className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center" style={{ background: tint, color: ink(tint) }}><Icon name={icon} size={22} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-sm td-strong">{label}</div>
        <div className="text-[12px] text-td-muted mt-0.5">{count} waiting for your review</div>
      </div>
      <span className="text-[12px] font-extrabold text-white bg-td-red rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">{count}</span>
      <ChevronRight />
    </button>
  )

  return (
    <div className="td-screen">
      <ScreenHeader title="Notifications" onBack={() => go('home', 'home')} />

      {empty ? (
        <div className="flex flex-col items-center text-center py-14">
          <div className="w-16 h-16 rounded-[20px] bg-td-tint-green flex items-center justify-center mb-4">
            <Icon name="reminder" size={30} color="var(--color-td-green)" />
          </div>
          <div className="text-[16px] td-strong">You&apos;re all caught up</div>
          <div className="text-[13px] text-td-muted mt-1 max-w-[240px]">New student and staff requests will show up here.</div>
        </div>
      ) : (
        <>
          {studentCount > 0 && row('requests', 'var(--color-td-tint-green)', 'Student join requests', studentCount, 'studentRequests')}
          {staffCount > 0 && row('approvals', 'var(--color-td-tint-indigo)', 'Staff access requests', staffCount, 'staffApprovals')}
        </>
      )}

      <EnablePushButton />
    </div>
  )
}

export function StaffProfileScreen() {
  const { go, role, myName, myPhone, mySubject, myQualification, googleEmail, saveStaffProfile, signOut, centreName, centreLogo, loadMyCentre, renameCentre, saveCentreLogo, notify, setMyPassword } = useDashboard()
  const isAdmin = role === 'admin'
  const logoInput = useRef<HTMLInputElement>(null)
  const [logoBusy, runLogo] = useBusy()
  const pickLogo = (file?: File) => runLogo(async () => {
    if (!file) return
    try { await saveCentreLogo(await fileToLogoDataUrl(file)) }
    catch (e) { notify(e instanceof Error ? e.message : 'Could not use that image') }
    finally { if (logoInput.current) logoInput.current.value = '' }
  })
  const [name, setName] = useState(myName)
  const [phone, setPhone] = useState(myPhone)
  const [subject, setSubject] = useState(mySubject)
  const [qualification, setQualification] = useState(myQualification)
  const [centre, setCentre] = useState(centreName)
  const [busy, run] = useBusy()
  const displayName = name || googleEmail?.split('@')[0] || (isAdmin ? 'Head teacher' : 'Teacher')

  useEffect(() => { if (isAdmin && !centreName) loadMyCentre() }, [isAdmin, centreName, loadMyCentre])

  // Sync the input when the centre name arrives (adjust-during-render pattern).
  const [prevCentreName, setPrevCentreName] = useState(centreName)
  if (centreName !== prevCentreName) { setPrevCentreName(centreName); setCentre(centreName) }

  const save = () => run(async () => {
    // Only touch the centre name if the profile itself saved — otherwise a
    // rejected phone number would still rename the centre, which looks like a
    // partial success and is hard to reason about.
    if (await saveStaffProfile({ name, phone, subject, qualification })
      && isAdmin && centre.trim() && centre.trim() !== centreName) await renameCentre(centre)
  })

  // Set an email+password login so this device (esp. the installed home-screen
  // app) can sign in without Google's redirect, which drops the session.
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwOpen, setPwOpen] = useState(false)
  const [pwBusy, runPw] = useBusy()
  const savePassword = () => runPw(async () => {
    if (pw !== pw2) { notify('Passwords do not match'); return }
    if (await setMyPassword(pw)) { setPw(''); setPw2(''); setPwOpen(false) }
  })

  return (
    <div className="td-screen">
      <ScreenHeader title="My Profile" onBack={() => go('more', 'more')} />

      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-[76px] h-[76px] rounded-[24px] flex items-center justify-center text-white font-extrabold text-[26px] mb-3" style={{ background: av(0) }}>{initials(displayName)}</div>
        <div className="text-[18px] td-strong">{displayName}</div>
        <div className="text-[12.5px] text-td-muted mt-0.5">{googleEmail}</div>
        <div className="inline-flex items-center gap-[6px] bg-td-tint-green rounded-[20px] py-[5px] px-[11px] mt-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-td-green" />
          <span className="text-[12px] font-bold text-td-green">{isAdmin ? 'Head teacher' : 'Teacher'}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 mb-[18px]">
        <div><label className="td-label">Full name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="td-field text-sm" /></div>
        <div><label className="td-label">Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91" className="td-field text-sm" /></div>
        <div><label className="td-label">Subject you teach</label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Mathematics, Physics" className="td-field text-sm" /></div>
        <div><label className="td-label">Qualification</label><input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="e.g. M.Sc. Mathematics" className="td-field text-sm" /></div>
        {isAdmin && (
          <div><label className="td-label">Centre name</label><input value={centre} onChange={e => setCentre(e.target.value)} placeholder="e.g. Bright Future Tuition" className="td-field text-sm" /></div>
        )}
        {isAdmin && (
          <div>
            <label className="td-label">Centre logo</label>
            <div className="flex items-center gap-3.5 border border-td-border rounded-[14px] p-3">
              <div className="w-14 h-14 rounded-[14px] overflow-hidden shrink-0 flex items-center justify-center bg-td-soft border border-td-border">
                {centreLogo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={centreLogo} alt="Centre logo" className="w-full h-full object-cover" />
                  : <span className="font-extrabold text-td-primary text-xl">{initials(centre || centreName || 'S')}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex gap-2">
                  <button onClick={() => logoInput.current?.click()} disabled={logoBusy} className="border border-td-border bg-td-card text-td-dark text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px] cursor-pointer disabled:opacity-60">{logoBusy ? 'Uploading…' : centreLogo ? 'Change' : 'Upload'}</button>
                  {centreLogo && !logoBusy && (
                    <button onClick={() => saveCentreLogo('')} className="td-danger text-[12.5px] font-extrabold py-2 px-3.5 rounded-[11px]">Remove</button>
                  )}
                </div>
                <p className="text-[12px] text-td-muted mt-1.5 leading-snug">Students who log in with your centre code see this logo.</p>
              </div>
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2.5 bg-td-soft border border-td-border rounded-[14px] p-3">
          <Icon name="info" size={15} color="var(--color-td-subtle)" />
          <span className="text-[12px] text-td-muted">Your email is managed by Google and can&apos;t be changed here.</span>
        </div>
      </div>

      <PrimaryButton onClick={save}>{busy ? 'Saving…' : 'Save changes'}</PrimaryButton>

      <EnablePushButton />

      {!pwOpen ? (
        <button onClick={() => setPwOpen(true)} className="w-full border border-td-border bg-td-card text-td-dark text-sm font-extrabold p-[15px] rounded-2xl cursor-pointer mt-3 flex items-center justify-center gap-2">
          <Icon name="lock" size={17} color="var(--color-td-primary)" />
          Set password for phone login
        </button>
      ) : (
        <div className="border border-td-border rounded-2xl p-4 mt-3">
          <div className="text-sm td-strong">Set a password</div>
          <p className="text-[12px] text-td-muted mt-1 leading-snug">Then sign in on the home-screen app with your email + this password — it keeps you logged in.</p>
          <input value={pw} type="password" autoComplete="new-password" onChange={e => setPw(e.target.value)} placeholder={`New password (min ${MIN_PASSWORD_LENGTH} chars)`} className="td-field text-sm mt-3" />
          <input value={pw2} type="password" autoComplete="new-password" onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === 'Enter' && !pwBusy && savePassword()} placeholder="Confirm password" className="td-field text-sm mt-2.5" />
          <div className="flex gap-2 mt-3">
            <button onClick={savePassword} disabled={pwBusy} className="td-pill flex-1 text-[13.5px] font-extrabold py-[12px] rounded-[12px] cursor-pointer disabled:opacity-60">{pwBusy ? 'Saving…' : 'Save password'}</button>
            <button onClick={() => { setPwOpen(false); setPw(''); setPw2('') }} className="border border-td-border bg-td-card text-td-muted text-[13.5px] font-bold py-[12px] px-4 rounded-[12px] cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <button onClick={signOut} className="w-full td-danger text-sm font-extrabold p-[15px] rounded-2xl mt-3 flex items-center justify-center gap-[9px]">
        <Icon name="signOut" size={17} color="var(--color-td-red)" />
        Sign out
      </button>
    </div>
  )
}
