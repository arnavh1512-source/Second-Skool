'use client'

import { useState, useEffect } from 'react'
import { useDashboard, GRADIENTS, initials, av, stuGrade } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight } from './Shell'
import { Icon, DataIcon, ink, type IconName } from './Icon'
import { LastUpdated } from './LastUpdated'
import { enablePush, pushSupported, testNotification } from '../lib/push'
import { teacherKey } from '../lib/student-key'

export function StuHomeScreen() {
  const { go, students, stuReminders, stuResults, stuAttendanceLog, stuPendingFee, currentStudentDbId, googleEmail, rankData, loadStudentByCode, stuMonthly, stuNotes, loadStudentNotes, centreName, centreLogo } = useDashboard()
  const [linkCode, setLinkCode] = useState('')
  const me = students.find(s => s.dbId === currentStudentDbId)

  // Cheap metadata load (no file bytes) so we can badge unseen study material.
  useEffect(() => { loadStudentNotes() }, [loadStudentNotes])
  const notesSeenAt = typeof window !== 'undefined' ? Number(localStorage.getItem('notes_seen_at') || 0) : 0
  const newNotes = stuNotes.filter(n => n.date && new Date(n.date).getTime() > notesSeenAt).length

  if (!currentStudentDbId) {
    return (
      <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 flex flex-col items-center justify-center min-h-[450px]">
        <button onClick={() => { useDashboard.getState().signOut() }} className="self-start border-none bg-transparent cursor-pointer flex items-center gap-1.5 text-td-muted text-[13px] font-bold mb-6">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7689" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <div className="w-[72px] h-[72px] rounded-[22px] bg-[#eaf1fc] flex items-center justify-center mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="text-[18px] font-extrabold text-td-dark mb-2">Link your account</div>
        <div className="text-[13px] text-td-muted text-center leading-relaxed mb-6 max-w-[280px]">Enter the student code your teacher gave you to link your account and see your data.</div>
        <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())} placeholder="e.g. TUT-1234" className="w-full max-w-[260px] border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary text-center tracking-wider font-bold mb-4" />
        <PrimaryButton onClick={() => loadStudentByCode(linkCode)}>Link account</PrimaryButton>
      </div>
    )
  }

  const displayName = me?.name ?? googleEmail?.split('@')[0] ?? 'Student'
  const ini = initials(displayName)
  const attendancePct = stuAttendanceLog.length > 0
    ? Math.round(stuAttendanceLog.filter(d => d.status === 'Present').length / stuAttendanceLog.length * 100)
    : 0
  const recentResults = stuResults.slice(0, 3)

  let rankInfo = { rank: 0, total: 0 }
  for (const entries of Object.values(rankData)) {
    const idx = entries.findIndex(([name]) => name === me?.name)
    if (idx >= 0 && (rankInfo.rank === 0 || idx + 1 < rankInfo.rank)) {
      rankInfo = { rank: idx + 1, total: entries.length }
    }
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {centreLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={centreLogo} alt={centreName || 'Centre'} className="w-[46px] h-[46px] rounded-2xl object-cover border border-td-border shrink-0" />
            : <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] shrink-0" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>{ini}</div>}
          <div className="min-w-0">
            <div className="text-xs text-td-muted font-semibold truncate">{centreName || 'Good morning'}</div>
            <div className="text-[17px] font-extrabold text-td-dark truncate">{displayName}</div>
          </div>
        </div>
        <button onClick={() => go('stuNotif', 'stuHome')} className="relative w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2" strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
          <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-white" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 mb-[18px]">
        <div className="inline-flex items-center gap-[7px] bg-white border border-td-border rounded-[20px] py-[7px] px-[13px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
          <span className="text-[12.5px] font-semibold text-td-text">{me?.school || 'Your branch'}</span>
        </div>
        {pushSupported() && me?.id && (
          <button onClick={async () => {
            const r = await enablePush('student', me.id)
            if (!r.ok) { useDashboard.getState().notify(r.error || 'Could not enable'); return }
            // Immediately prove the device can actually display one. Turning
            // alerts "on" and seeing nothing for days is how a student ends up
            // believing the app is broken when it's a phone setting.
            const t = await testNotification(useDashboard.getState().centreName)
            useDashboard.getState().notify(t.ok ? 'Alerts on — check your notifications for a test' : (t.error || 'Alerts on'))
          }} className="inline-flex items-center gap-1.5 bg-[#eaf1fc] text-td-primary text-[12px] font-bold py-[7px] px-3 rounded-[20px] cursor-pointer border-none shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            Alerts
          </button>
        )}
      </div>

      <div className="mb-3.5">
        <LastUpdated />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <button onClick={() => go('stuAttendance', 'stuHome')} className="rounded-[18px] p-3.5 text-white text-left border-none cursor-pointer" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
          <div className="text-2xl font-extrabold leading-none">{attendancePct}%</div>
          <div className="text-[12px] opacity-85 mt-1.5 font-semibold">Attendance</div>
        </button>
        <button onClick={() => go('stuRanking', 'stuRanking')} className="bg-white border border-td-border rounded-[18px] p-3.5 text-left cursor-pointer">
          {rankInfo.rank > 0 ? (
            <>
              <div className="text-2xl font-extrabold leading-none text-td-dark">#{rankInfo.rank}<span className="text-sm text-td-muted font-semibold"> / {rankInfo.total}</span></div>
              <div className="text-[12px] text-td-muted mt-1.5 font-semibold">Class Rank</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-extrabold leading-none text-td-dark">&mdash;</div>
              <div className="text-[12px] text-td-muted mt-1.5 font-semibold">No rank yet</div>
            </>
          )}
        </button>
      </div>

      {stuMonthly && (stuMonthly.attTotal > 0 || stuMonthly.tests > 0) && (
        <div className="rounded-[18px] p-4 mb-3.5 text-white" style={{ background: 'linear-gradient(135deg,#2fa36b,#4db786)' }}>
          <div className="text-[12px] font-bold opacity-85 mb-2.5">THIS MONTH</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[19px] font-extrabold leading-none">{stuMonthly.attTotal > 0 ? `${Math.round((stuMonthly.attPresent / stuMonthly.attTotal) * 100)}%` : '—'}</div>
              <div className="text-[12px] opacity-80 mt-1 font-semibold">Attendance</div>
            </div>
            <div>
              <div className="text-[19px] font-extrabold leading-none">{stuMonthly.tests}</div>
              <div className="text-[12px] opacity-80 mt-1 font-semibold">Tests</div>
            </div>
            <div>
              <div className="text-[19px] font-extrabold leading-none">{stuMonthly.tests > 0 ? `${stuMonthly.avgPct}%` : '—'}</div>
              <div className="text-[12px] opacity-80 mt-1 font-semibold">Avg score</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <button onClick={() => go('stuTimetable', 'stuHome')} className="text-left bg-white border border-td-border rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-[#eef0fc] flex items-center justify-center mb-2" style={{ color: ink('#eef0fc') }}><Icon name="timetable" size={20} /></div>
          <div className="text-[12.5px] font-extrabold text-td-dark leading-tight">Timetable</div>
        </button>
        <button onClick={() => go('stuAssignments', 'stuHome')} className="text-left bg-white border border-td-border rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-[#fcf3e3] flex items-center justify-center mb-2" style={{ color: ink('#fcf3e3') }}><Icon name="homework" size={20} /></div>
          <div className="text-[12.5px] font-extrabold text-td-dark leading-tight">Homework</div>
        </button>
        <button onClick={() => go('stuNotes', 'stuHome')} className="relative text-left bg-white border border-td-border rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-[#e7f5ee] flex items-center justify-center mb-2" style={{ color: ink('#e7f5ee') }}><Icon name="notes" size={20} /></div>
          <div className="text-[12.5px] font-extrabold text-td-dark leading-tight">Material</div>
          {newNotes > 0 && <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-td-red text-white text-[12px] font-extrabold flex items-center justify-center">{newNotes}</span>}
        </button>
      </div>

      {stuPendingFee && (
        <button onClick={() => go('stuFees', 'stuHome')} className="w-full text-left border-none cursor-pointer rounded-[18px] p-[15px] flex items-center gap-[13px] mb-5" style={{ background: 'linear-gradient(135deg,#e8553c,#ef7a64)' }}>
          <div className="w-[42px] h-[42px] rounded-[13px] bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="fees" size={21} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-white">{stuPendingFee.amount} fee due</div>
            <div className="text-xs text-white/70 mt-0.5">Due by {stuPendingFee.dueDate}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.4" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      )}

      {stuReminders.length > 0 && (
        <>
          <div className="text-base font-extrabold text-td-dark mb-[13px]">Reminders</div>
          <div className="flex flex-col gap-2.5 mb-[22px]">
            {stuReminders.map(r => (
              <button key={r.title + r.when} onClick={() => go('stuNotif', 'stuHome')} className="w-full text-left bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px] cursor-pointer">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: r.tint, color: ink(r.tint) }}><DataIcon value={r.icon} size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold text-td-dark">{r.title}</div>
                  <div className="text-xs text-td-muted mt-0.5 truncate">{r.detail}</div>
                </div>
                <span className="text-[12px] text-td-subtle font-semibold shrink-0">{r.when}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round" className="shrink-0"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        </>
      )}

      {recentResults.length > 0 && (
        <>
          <div className="text-base font-extrabold text-td-dark mb-[13px]">Recent results</div>
          <div className="flex flex-col gap-2.5">
            {recentResults.map(r => {
              const pct = Math.round((r.marks / r.total) * 100)
              const g = stuGrade(pct)
              return (
                <div key={r.subject + r.test} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
                  <span className="text-[12px] font-extrabold py-[5px] px-2.5 rounded-[10px]" style={{ color: g.c, background: g.t }}>{g.g}</span>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-bold text-td-dark">{r.subject}</div>
                    <div className="text-xs text-td-muted mt-0.5">{r.test} · {r.date}</div>
                  </div>
                  <div className="text-sm font-extrabold text-td-dark">{r.marks}/{r.total}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {stuReminders.length === 0 && recentResults.length === 0 && !stuPendingFee && (
        <div className="text-center text-td-muted text-sm py-8">No updates yet — check back later</div>
      )}
    </div>
  )
}

export function StuAttendanceScreen() {
  const { go, stuAttendanceLog } = useDashboard()
  const total = stuAttendanceLog.length
  const present = stuAttendanceLog.filter(d => d.status === 'Present').length
  const absent = stuAttendanceLog.filter(d => d.status === 'Absent').length
  const leaves = stuAttendanceLog.filter(d => d.status === 'Leave').length
  const pct = total > 0 ? Math.round((present / total) * 100) : 0
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Attendance" onBack={() => go('stuHome', 'stuHome')} />

      <div className="rounded-[22px] p-5 text-white mb-5 flex items-center gap-5" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="7" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 50 50)" />
          <text x="50" y="46" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">{pct}%</text>
          <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9" fontWeight="600">Present</text>
        </svg>
        <div>
          <div className="text-[15px] font-extrabold">Present this term</div>
          <div className="text-[12.5px] opacity-80 mt-1.5 leading-relaxed">
            {total > 0 ? <>{present} of {total} class days attended.<br/>{absent} absences, {leaves} leaves.</> : 'No attendance data yet.'}
          </div>
        </div>
      </div>

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Recent days</div>
      {stuAttendanceLog.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No attendance records yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuAttendanceLog.map(d => (
            <div key={d.date} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: d.tint, color: ink(d.tint) }}><DataIcon value={d.icon} size={20} /></div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{d.day}</div>
                <div className="text-xs text-td-muted mt-0.5">{d.date}</div>
              </div>
              <span className="text-[12px] font-bold" style={{ color: d.color }}>{d.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuResultsScreen() {
  const { stuResults, students, currentStudentDbId } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const totalMarks = stuResults.reduce((a, r) => a + r.marks, 0)
  const totalMax = stuResults.reduce((a, r) => a + r.total, 0)
  const avg = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
  const overall = stuGrade(avg)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1">Test Results</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{me?.klass ?? ''} · {me?.school ?? ''}</div>

      {stuResults.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No results available yet</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="rounded-[18px] p-3.5 text-center" style={{ background: overall.t }}>
              <div className="text-2xl font-extrabold" style={{ color: overall.c }}>{overall.g}</div>
              <div className="text-[12px] font-semibold mt-1" style={{ color: overall.c, opacity: .7 }}>Overall grade</div>
            </div>
            <div className="bg-white border border-td-border rounded-[18px] p-3.5 text-center">
              <div className="text-2xl font-extrabold text-td-dark">{avg}%</div>
              <div className="text-[12px] text-td-muted font-semibold mt-1">Average</div>
            </div>
          </div>

          <div className="text-base font-extrabold text-td-dark mb-[13px]">All subjects</div>
          <div className="flex flex-col gap-2.5">
            {stuResults.map(r => {
              const pct = Math.round((r.marks / r.total) * 100)
              const g = stuGrade(pct)
              return (
                <div key={r.subject + r.test} className="bg-white border border-td-border rounded-[18px] p-3.5">
                  <div className="flex items-center gap-[13px] mb-2.5">
                    <span className="text-[12px] font-extrabold py-[5px] px-2.5 rounded-[10px]" style={{ color: g.c, background: g.t }}>{g.g}</span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-bold text-td-dark">{r.subject}</div>
                      <div className="text-xs text-td-muted mt-0.5">{r.test} · {r.date}</div>
                    </div>
                    <div className="text-sm font-extrabold text-td-dark">{r.marks}/{r.total}</div>
                  </div>
                  <div className="w-full h-[7px] bg-[#eef1f7] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.c }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function StuRankingScreen() {
  const { stuRankSubject, rankData, subjects: subjectsList, students, currentStudentDbId, set } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const subjectNames = subjectsList.length ? subjectsList.map(s => s.name) : Object.keys(rankData)
  const rows = (rankData[stuRankSubject] || []).map((r, i) => ({ rank: i + 1, name: r[0], score: r[1] }))
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const medals: IconName[] = ['silver', 'gold', 'bronze']
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
  const podiumHeights = [88, 110, 72]
  const podiumBg = ['#c0cfe8', '#2a6fdb', '#d4c9a8']
  // Silver, gold, bronze — podium order, not rank order.
  const MEDAL_INK = ['#8f9bb3', '#e0962f', '#b06a3a']

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1">Ranking</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{me?.klass ?? ''}{stuRankSubject ? ` · ${stuRankSubject}` : ''}</div>

      {subjectNames.length > 0 && (
        <div className="flex gap-[9px] overflow-x-auto mb-[22px] scrollbar-hide">
          {subjectNames.map(name => {
            const active = name === stuRankSubject
            return (
              <button key={name} onClick={() => set({ stuRankSubject: name })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
            )
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10 leading-relaxed">No rankings published yet.<br />They&apos;ll appear once your teacher enters results.</div>
      ) : (
        <>
          {top3.length >= 3 && (
            <div className="flex justify-center items-end gap-[7px] mb-6">
              {podiumOrder.map((p, pi) => {
                const isYou = me?.name === p.name
                return (
                  <div key={p.name} className="flex flex-col items-center">
                    <Icon name={medals[pi]} size={26} className="mb-1" style={{ color: MEDAL_INK[pi] }} />
                    <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] mb-1.5" style={{ background: GRADIENTS[pi] }}>{initials(p.name)}</div>
                    <div className="text-[12px] font-extrabold text-td-dark text-center leading-tight mb-0.5">{p.name.split(' ')[0]}{isYou && <span className="text-td-primary"> (You)</span>}</div>
                    <div className="text-[12px] font-bold text-td-primary mb-1.5">{p.score}%</div>
                    <div className="w-[72px] rounded-t-[10px]" style={{ height: podiumHeights[pi], background: podiumBg[pi] }} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-[13px] font-extrabold text-td-dark mb-[11px]">Leaderboard</div>
          <div className="flex flex-col gap-[9px]">
            {rest.map(r => {
              const isYou = me?.name === r.name
              return (
                <div key={r.name} className="flex items-center gap-[13px] border rounded-2xl p-3 px-3.5" style={{ background: isYou ? '#eaf1fc' : '#fff', borderColor: isYou ? '#2a6fdb' : '#e6eaf2' }}>
                  <div className="w-[26px] text-center text-sm font-extrabold text-td-subtle">{r.rank}</div>
                  <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(r.rank) }}>{initials(r.name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}{isYou && <span className="text-td-primary text-xs"> (You)</span>}</div>
                  <div className="text-sm font-extrabold text-td-dark">{r.score}%</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function StuTeachersScreen() {
  const { teachers, set, go } = useDashboard()

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="text-2xl font-extrabold text-td-dark mt-1.5 mb-1">Teachers</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{teachers.length} faculty at your branch</div>

      {teachers.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No teachers listed yet</div>
      ) : (
        <div className="flex flex-col gap-3">
          {teachers.map((t, i) => (
            <button key={teacherKey(t)} onClick={() => { set({ stuTeacherId: teacherKey(t) }); go('stuTeacher', 'stuTeachers') }} className="text-left bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-3.5 cursor-pointer">
              <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>{initials(t.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold text-td-dark">{t.name}</div>
                <div className="text-[12.5px] text-td-primary font-bold mt-0.5">{t.subject}</div>
                <div className="text-[12px] text-td-muted mt-[3px]">{t.experience} yrs · {t.qualification}</div>
              </div>
              <ChevronRight />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuTeacherDetail() {
  const { teachers, stuTeacherId, go } = useDashboard()
  // Remembered by identity. The teacher list is fetched created_at DESC and
  // re-pulled on every background refresh, so a position captured a moment ago
  // points at a different person as soon as anyone is added.
  const t = teachers.find(x => teacherKey(x) === stuTeacherId) || teachers[0]
  const gradIdx = Math.max(0, teachers.indexOf(t))
  if (!t) return <div className="text-center text-td-muted py-8">No teacher data</div>

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Teacher Profile" onBack={() => go('stuTeachers', 'stuTeachers')} />

      <div className="flex flex-col items-center mb-5">
        <div className="w-[80px] h-[80px] rounded-3xl flex items-center justify-center text-white font-extrabold text-[28px] mb-3" style={{ background: GRADIENTS[gradIdx % GRADIENTS.length] }}>{initials(t.name)}</div>
        <div className="text-[20px] font-extrabold text-td-dark">{t.name}</div>
        <span className="text-[12px] font-bold text-td-primary bg-[#eaf1fc] py-[5px] px-3 rounded-[20px] mt-2">{t.subject}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="bg-white border border-td-border rounded-[18px] p-3.5 text-center">
          <div className="text-2xl font-extrabold text-td-dark">{t.experience}</div>
          <div className="text-[12px] text-td-muted font-semibold mt-1">Years exp.</div>
        </div>
        <div className="bg-white border border-td-border rounded-[18px] p-3.5 text-center">
          <div className="text-2xl font-extrabold text-td-amber flex items-center justify-center gap-1.5"><Icon name="star" size={20} />{t.rating || '—'}</div>
          <div className="text-[12px] text-td-muted font-semibold mt-1">Rating</div>
        </div>
      </div>

      <div className="bg-white border border-td-border rounded-[18px] p-4 mb-3">
        <div className="text-[13px] font-extrabold text-td-dark mb-2">Qualification</div>
        <div className="text-[13px] text-td-muted">{t.qualification}</div>
      </div>

      {t.about && (
        <div className="bg-white border border-td-border rounded-[18px] p-4">
          <div className="text-[13px] font-extrabold text-td-dark mb-2">About</div>
          <div className="text-[13px] text-td-muted leading-relaxed">{t.about}</div>
        </div>
      )}
    </div>
  )
}

export function StuFeesScreen() {
  const { go, notify, stuFeeHistory, stuPendingFee } = useDashboard()

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Fees" onBack={() => go('stuHome', 'stuHome')} />

      {stuPendingFee ? (
        <div className="rounded-[22px] p-5 text-white mb-5" style={{ background: 'linear-gradient(135deg,#e8553c,#ef7a64)' }}>
          <div className="text-xs opacity-70 font-semibold">Amount due</div>
          <div className="text-[28px] font-extrabold mt-1">{stuPendingFee.amount}</div>
          <div className="text-[12.5px] opacity-80 mt-1">{stuPendingFee.period} · Due {stuPendingFee.dueDate}</div>
          <button onClick={() => notify('Contact your teacher to arrange payment')} className="w-full mt-4 border-none bg-white text-td-red text-sm font-extrabold py-3.5 rounded-[14px] cursor-pointer">Pay now</button>
        </div>
      ) : (
        <div className="rounded-[22px] p-5 text-white mb-5 text-center" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>
          <div className="text-[22px] font-extrabold">All clear!</div>
          <div className="text-[12.5px] opacity-80 mt-1">No pending fees</div>
        </div>
      )}

      <div className="text-base font-extrabold text-td-dark mb-[13px]">Payment history</div>
      {stuFeeHistory.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No payment history yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuFeeHistory.map(f => (
            <div key={f.period} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-[#e7f5ee]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2fa36b" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold text-td-dark">{f.period}</div>
                <div className="text-xs text-td-muted mt-0.5">Paid on {f.date}</div>
              </div>
              <div className="text-sm font-extrabold text-td-green">{f.amount}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuNotifScreen() {
  const { go, stuNotifications } = useDashboard()

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Notifications" onBack={() => go('stuHome', 'stuHome')} />

      {stuNotifications.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No notifications yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuNotifications.map(n => (
            <div key={n.title + n.when} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-start gap-[13px]">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center mt-0.5" style={{ background: n.tint, color: ink(n.tint) }}><DataIcon value={n.icon} size={20} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold text-td-dark">{n.title}</div>
                <div className="text-xs text-td-muted mt-1 leading-relaxed">{n.detail}</div>
                <div className="text-[12px] text-td-subtle font-semibold mt-1.5">{n.when}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StuTimetableScreen() {
  const { go, timetableData } = useDashboard()
  const dayNames: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }
  const [day, setDay] = useState(['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()])
  const periods = timetableData[day] || []

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="My Timetable" onBack={() => go('stuHome', 'stuHome')} />

      <div className="flex gap-2 overflow-x-auto mb-[18px] scrollbar-hide">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
          const active = d === day
          return (
            <button key={d} onClick={() => setDay(d)} className="shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-3 cursor-pointer text-center" style={{ background: active ? '#2a6fdb' : '#fff', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>
              <div className="text-[12px] font-bold" style={{ color: active ? '#fff' : '#3a4456' }}>{d}</div>
            </button>
          )
        })}
      </div>

      <div className="text-[13px] text-td-muted font-semibold mb-3.5">{dayNames[day]} · {periods.length} {periods.length === 1 ? 'class' : 'classes'}</div>

      {periods.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10">No classes scheduled for {dayNames[day]}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {periods.map((p) => {
            const free = p[2] === 'Free period'
            return (
              <div key={`${p[0]}-${p[2]}`} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
                <div className="text-center shrink-0 w-[56px]">
                  <div className="text-[12.5px] font-extrabold text-td-primary">{p[0]}</div>
                  <div className="text-[12px] text-td-subtle font-semibold">{p[1]}</div>
                </div>
                <div className="w-px h-[34px] bg-[#eef1f7]" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: free ? '#9aa4b6' : '#1a2332' }}>{p[2]}</div>
                  {p[4] && <div className="text-xs text-td-muted mt-0.5">{p[4]}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StuAssignmentsScreen() {
  const { go, stuAssignments } = useDashboard()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Homework" onBack={() => go('stuHome', 'stuHome')} />

      {stuAssignments.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-12 leading-relaxed">No homework assigned yet.<br />New assignments from your teacher will appear here.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuAssignments.map((a) => {
            const akey = `${a.due}-${a.subject}-${a.title}`
            return (
            <button key={akey} onClick={() => setOpen(open === akey ? null : akey)} className="w-full text-left bg-white border border-td-border rounded-[18px] p-4 cursor-pointer">
              <div className="flex items-center gap-[13px]">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-[#fcf3e3]" style={{ color: ink('#fcf3e3') }}><Icon name="homework" size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-extrabold text-td-dark">{a.title}</div>
                  <div className="text-[12px] text-td-muted mt-0.5">{a.subject}{a.due ? ` · due ${a.due}` : ''}</div>
                </div>
                {a.instructions && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.4" strokeLinecap="round" className={`shrink-0 transition-transform ${open === akey ? 'rotate-90' : ''}`}><path d="m9 18 6-6-6-6"/></svg>}
              </div>
              {open === akey && a.instructions && <div className="text-[13px] text-td-text leading-relaxed mt-3 pt-3 border-t border-[#f0f2f7]">{a.instructions}</div>}
            </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StuProfileScreen() {
  const { signOut, students, currentStudentDbId, stuResults, googleEmail, notify } = useDashboard()
  const me = students.find(s => s.dbId === currentStudentDbId)
  const displayName = me?.name ?? googleEmail?.split('@')[0] ?? 'Student'
  const ini = initials(displayName)
  const totalMarks = stuResults.reduce((a, r) => a + r.marks, 0)
  const totalMax = stuResults.reduce((a, r) => a + r.total, 0)
  const avg = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
  const grade = stuGrade(avg)

  // Every detail is centre-managed. A student can view but never change their
  // own record — only the head teacher edits it (from Students → Edit Student).
  const fields: { icon: IconName; label: string; value: string; locked: boolean }[] = [
    { icon: 'school', label: 'School', value: me?.school || '—', locked: true },
    { icon: 'standard', label: 'Standard', value: me?.klass || '—', locked: true },
    { icon: 'phone', label: 'Parent contact', value: me?.parent || '—', locked: true },
    { icon: 'address', label: 'Address', value: me?.address || '—', locked: true },
  ]

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mt-1.5 mb-[18px]">
        <div className="text-2xl font-extrabold text-td-dark">My Profile</div>
        <button onClick={signOut} className="border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12.5px] font-bold py-2 px-3 rounded-[12px] cursor-pointer">Sign out</button>
      </div>

      <div className="rounded-[22px] p-5 text-white flex items-center gap-4 mb-5" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
        <div className="w-[64px] h-[64px] rounded-2xl bg-white/20 flex items-center justify-center text-white font-extrabold text-[22px] shrink-0">{ini}</div>
        <div>
          <div className="text-[18px] font-extrabold">{displayName}</div>
          <div className="text-[12.5px] opacity-80 mt-0.5">{me?.klass ?? ''}</div>
          {stuResults.length > 0 && (
            <span className="inline-block text-[12px] font-bold bg-white/20 py-1 px-2.5 rounded-[20px] mt-1.5">{grade.g} · {avg}%</span>
          )}
        </div>
      </div>

      {/* The code is how a student signs back in — on a new phone, after
          clearing the browser, after a reinstall. It's issued once at
          registration and then only ever lived in a toast, so anyone who
          didn't write it down was locked out. It belongs here permanently. */}
      {me?.id && (
        <button
          onClick={() => { navigator.clipboard.writeText(me.id); notify('Code copied!') }}
          className="w-full text-left border-2 border-dashed border-td-primary bg-[#eaf1fc] rounded-[18px] p-3.5 mb-5 cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="text-[12px] font-bold text-td-muted">YOUR STUDENT CODE</div>
            <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em] truncate">{me.id}</div>
            <div className="text-[12px] text-td-muted mt-0.5">Use this to sign in on any device. Keep it private.</div>
          </div>
          <div className="text-[12px] font-bold text-td-primary flex items-center gap-1 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a6fdb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </div>
        </button>
      )}

      <div className="flex flex-col gap-2.5 mb-5">
        {fields.map(f => (
          <div key={f.label} className="bg-white border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px]">
            <Icon name={f.icon} size={20} className="text-td-muted shrink-0" />
            <div className="flex-1">
              <div className="text-[12px] text-td-subtle font-semibold">{f.label}</div>
              <div className="text-[13.5px] font-bold text-td-dark mt-0.5">{f.value}</div>
            </div>
            {f.locked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2cad8" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>}
          </div>
        ))}
      </div>

      <div className="text-[12px] text-td-subtle text-center leading-relaxed">Your details are managed by your tuition centre and can&apos;t be changed here. Ask your teacher if something needs updating.</div>
    </div>
  )
}
