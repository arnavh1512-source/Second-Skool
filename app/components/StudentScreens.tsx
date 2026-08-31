'use client'

import { useState, useEffect } from 'react'
import { copyText } from '../lib/share'
import { useDashboard, GRADIENTS, initials, av, rupee, stuGrade, type Teacher } from '../store'
import { ScreenHeader, PrimaryButton, ChevronRight, Chip, CodeCard } from './Shell'
import { Icon, DataIcon, ink, type IconName } from './Icon'
import { LastUpdated } from './LastUpdated'
import { ThemeToggle } from './ThemeToggle'
import { enablePush, pushSupported, testNotification } from '../lib/push'
import { readStudentCred } from '../lib/student-cred'
import { teacherKey } from '../lib/student-key'
import { readLocal, writeLocal } from '../lib/storage'

// The signed-in child. No student screen is handed one, so each of them
// found it the same way; this is that lookup, once.
const useMe = () => useDashboard(s => s.students.find(x => x.dbId === s.currentStudentDbId))

export function StuHomeScreen() {
  const { go, stuReminders, stuNotifications, stuResults, stuPendingFee, currentStudentDbId, googleEmail, rankData, loadStudentByCode, stuMonthly, stuNotes, loadStudentNotes, centreName, centreLogo } = useDashboard()
  const [linkCode, setLinkCode] = useState('')
  const me = useMe()

  // Cheap metadata load (no file bytes) so we can badge unseen study material.
  useEffect(() => { loadStudentNotes() }, [loadStudentNotes])
  const notesSeenAt = Number(readLocal('notes_seen_at') || 0)
  const newNotes = stuNotes.filter(n => n.date && new Date(n.date).getTime() > notesSeenAt).length
  // The bell dot used to be unconditional, so it said "you have something new"
  // from the first launch and never stopped — which is the same as saying
  // nothing. The feed is newest-first, so remembering the newest item the
  // student has already opened is enough to know whether anything arrived.
  const hasNewNotif = stuNotifications.length > 0 && stuNotifications[0].dbId !== readLocal('notif_seen_top')

  if (!currentStudentDbId) {
    return (
      <div className="td-screen flex flex-col items-center justify-center min-h-[450px]">
        <button onClick={() => { useDashboard.getState().signOut() }} className="td-plain self-start cursor-pointer flex items-center gap-1.5 text-td-muted text-[13px] font-bold mb-6">
          <Icon name="back" size={18} color="var(--color-td-muted)" />
          Back
        </button>
        <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-blue flex items-center justify-center mb-5">
          <Icon name="students" size={32} color="var(--color-td-primary)" />
        </div>
        <div className="text-[18px] td-strong mb-2">Link your account</div>
        <div className="text-[13px] text-td-muted text-center leading-relaxed mb-6 max-w-[280px]">Enter the student code your teacher gave you to link your account and see your data.</div>
        <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())} placeholder="e.g. TUT-1234" className="td-field max-w-[260px] text-sm text-center tracking-wider font-bold mb-4" />
        <PrimaryButton onClick={() => loadStudentByCode(linkCode)}>Link account</PrimaryButton>
      </div>
    )
  }

  const displayName = me?.name ?? googleEmail?.split('@')[0] ?? 'Student'
  const ini = initials(displayName)
  // The student's own lifetime figure, not a recount of stuAttendanceLog — that
  // list is capped at the last 15 days for the log below it, so recomputing from
  // it made this tile disagree with the Attendance screen sitting one tap away.
  //
  // null, not 0. A child who has never been marked has no attendance percentage,
  // and this tile is the first thing their parent sees: showing "0%" told them
  // their child had missed every single class since joining.
  const attendancePct = (me?.attendanceMarked ?? 0) > 0 ? me?.attendance ?? null : null
  const recentResults = stuResults.slice(0, 3)

  // Matched on the student's row id. Matching on the name put a child at their
  // namesake's rank, and on a board carrying both of them it picked whichever
  // one the query happened to sort first. The name is the fallback only for a
  // board that came from a database without the ranking migration applied.
  let rankInfo = { rank: 0, total: 0 }
  for (const entries of Object.values(rankData)) {
    const idx = entries.findIndex(r => r.id ? r.id === currentStudentDbId : r.name === me?.name)
    if (idx >= 0 && (rankInfo.rank === 0 || idx + 1 < rankInfo.rank)) {
      rankInfo = { rank: idx + 1, total: entries.length }
    }
  }

  return (
    <div className="td-screen">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {centreLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={centreLogo} alt={centreName || 'Centre'} className="w-[46px] h-[46px] rounded-2xl object-cover border border-td-border shrink-0" />
            : <div className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] shrink-0" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>{ini}</div>}
          <div className="min-w-0">
            <div className="text-xs text-td-muted font-semibold truncate">{centreName || 'Good morning'}</div>
            <div className="text-[17px] td-strong truncate">{displayName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button onClick={() => go('stuNotif', 'stuHome')} aria-label="Notifications" className="relative w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer">
            <Icon name="reminder" size={20} color="var(--color-td-dark)" />
            {hasNewNotif && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-td-card" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-[18px]">
        <div className="inline-flex items-center gap-[7px] td-card rounded-[20px] py-[7px] px-[13px]">
          <Icon name="branches" size={14} color="var(--color-td-primary)" />
          <span className="text-[12.5px] font-semibold text-td-text">{me?.school || 'Your branch'}</span>
        </div>
        {pushSupported() && me?.id && (
          <button onClick={async () => {
            const r = await enablePush('student', readStudentCred() ?? me.id)
            if (!r.ok) { useDashboard.getState().notify(r.error || 'Could not enable'); return }
            // Immediately prove the device can actually display one. Turning
            // alerts "on" and seeing nothing for days is how a student ends up
            // believing the app is broken when it's a phone setting.
            const t = await testNotification(useDashboard.getState().centreName)
            useDashboard.getState().notify(t.ok ? 'Alerts on — check your notifications for a test' : (t.error || 'Alerts on'))
          }} className="inline-flex items-center gap-1.5 bg-td-tint-blue text-td-primary text-[12px] font-bold py-[7px] px-3 rounded-[20px] cursor-pointer border-none shrink-0">
            <Icon name="reminder" size={13} color="var(--color-td-primary)" />
            Alerts
          </button>
        )}
      </div>

      <div className="mb-3.5">
        <LastUpdated />
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3.5">
        <button onClick={() => go('stuAttendance', 'stuHome')} className="rounded-[18px] p-3.5 text-white text-left border-none cursor-pointer" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
          <div className="text-2xl font-extrabold leading-none">{attendancePct === null ? '—' : `${attendancePct}%`}</div>
          <div className="text-[12px] opacity-85 mt-1.5 font-semibold">Attendance</div>
        </button>
        <button onClick={() => go('stuRanking', 'stuRanking')} className="td-card rounded-[18px] p-3.5 text-left cursor-pointer">
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
        <button onClick={() => go('stuTimetable', 'stuHome')} className="text-left td-card rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-td-tint-indigo flex items-center justify-center mb-2" style={{ color: ink('var(--color-td-tint-indigo)') }}><Icon name="timetable" size={20} /></div>
          <div className="text-[12.5px] td-strong leading-tight">Timetable</div>
        </button>
        <button onClick={() => go('stuAssignments', 'stuHome')} className="text-left td-card rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-td-tint-amber flex items-center justify-center mb-2" style={{ color: ink('var(--color-td-tint-amber)') }}><Icon name="homework" size={20} /></div>
          <div className="text-[12.5px] td-strong leading-tight">Homework</div>
        </button>
        <button onClick={() => go('stuNotes', 'stuHome')} className="relative text-left td-card rounded-[18px] p-3 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[12px] bg-td-tint-green flex items-center justify-center mb-2" style={{ color: ink('var(--color-td-tint-green)') }}><Icon name="notes" size={20} /></div>
          <div className="text-[12.5px] td-strong leading-tight">Material</div>
          {newNotes > 0 && <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-td-red text-white text-[12px] font-extrabold flex items-center justify-center">{newNotes}</span>}
        </button>
      </div>

      {stuPendingFee && (
        <button onClick={() => go('stuFees', 'stuHome')} className="w-full text-left border-none cursor-pointer rounded-[18px] p-[15px] flex items-center gap-[13px] mb-5" style={{ background: 'linear-gradient(135deg,#e8553c,#ef7a64)' }}>
          <div className="w-[42px] h-[42px] rounded-[13px] bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="fees" size={21} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-white">{stuPendingFee.amount} fee {stuPendingFee.overdue ? 'overdue' : 'due'}</div>
            <div className="text-xs text-white/70 mt-0.5">{stuPendingFee.overdue ? 'Was due' : 'Due by'} {stuPendingFee.dueDate}</div>
          </div>
          <Icon name="next" size={18} color="rgba(255,255,255,.5)" />
        </button>
      )}

      {stuReminders.length > 0 && (
        <>
          <div className="td-h2">Reminders</div>
          <div className="flex flex-col gap-2.5 mb-[22px]">
            {stuReminders.map((r, i) => (
              <button key={`${r.dbId ?? ''}-${i}`} onClick={() => go('stuNotif', 'stuHome')} className="td-row w-full text-left cursor-pointer">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: r.tint, color: ink(r.tint) }}><DataIcon value={r.icon} size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold text-td-dark">{r.title}</div>
                  <div className="text-xs text-td-muted mt-0.5 truncate">{r.detail}</div>
                </div>
                <span className="text-[12px] text-td-subtle font-semibold shrink-0">{r.when}</span>
                <Icon name="next" size={16} color="var(--color-td-faint)" className="shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}

      {recentResults.length > 0 && (
        <>
          <div className="td-h2">Recent results</div>
          <div className="flex flex-col gap-2.5">
            {recentResults.map((r, i) => {
              // A test with no max marks recorded divides to NaN, and "NaN%"
              // is what the parent reads on their child's report.
              const pct = r.total > 0 ? Math.round((r.marks / r.total) * 100) : 0
              const g = stuGrade(pct)
              return (
                <div key={`${r.subject}-${r.test}-${i}`} className="td-row">
                  <span className="text-[12px] font-extrabold py-[5px] px-2.5 rounded-[10px]" style={{ color: g.c, background: g.t }}>{g.g}</span>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-bold text-td-dark">{r.subject}</div>
                    <div className="text-xs text-td-muted mt-0.5">{r.test} · {r.date}</div>
                  </div>
                  <div className="text-sm td-strong">{r.marks}/{r.total}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {stuReminders.length === 0 && recentResults.length === 0 && !stuPendingFee && (
        <div className="td-none">No updates yet — check back later</div>
      )}
    </div>
  )
}

export function StuAttendanceScreen() {
  const { go, stuAttendanceLog } = useDashboard()
  const me = useMe()
  // The ring is the lifetime figure. It used to be computed from
  // stuAttendanceLog, which the snapshot caps at the last 15 marked days, so
  // this said "Present this term" over a number that covered three weeks — and
  // it moved every time one more day was marked. The daily list below still
  // shows those 15 days, and the sentence that describes them says so.
  const total = me?.attendanceMarked ?? 0
  const present = Math.round((me?.attendance ?? 0) / 100 * total)
  const pct = total > 0 ? (me?.attendance ?? 0) : 0
  const recent = stuAttendanceLog.length
  const absent = stuAttendanceLog.filter(d => d.status === 'Absent').length
  const leaves = stuAttendanceLog.filter(d => d.status === 'Leave').length
  const r = 42
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)

  return (
    <div className="td-screen">
      <ScreenHeader title="Attendance" onBack={() => go('stuHome', 'stuHome')} />

      <div className="rounded-[22px] p-5 text-white mb-5 flex items-center gap-5" style={{ background: 'linear-gradient(135deg,#2a6fdb,#3f82ec)' }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="7" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 50 50)" />
          <text x="50" y="46" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">{pct}%</text>
          <text x="50" y="62" textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="9" fontWeight="600">Present</text>
        </svg>
        <div>
          <div className="text-[15px] font-extrabold">Present overall</div>
          <div className="text-[12.5px] opacity-80 mt-1.5 leading-relaxed">
            {total > 0 ? <>{present} of {total} class days attended.<br/>{absent} absences, {leaves} leaves in the last {recent} days.</> : 'No attendance data yet.'}
          </div>
        </div>
      </div>

      <div className="td-h2">Recent days</div>
      {stuAttendanceLog.length === 0 ? (
        <div className="td-none">No attendance records yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuAttendanceLog.map((d, i) => (
            <div key={`${d.date}-${i}`} className="td-row">
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
  const { stuResults } = useDashboard()
  const me = useMe()
  const totalMarks = stuResults.reduce((a, r) => a + r.marks, 0)
  const totalMax = stuResults.reduce((a, r) => a + r.total, 0)
  const avg = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
  const overall = stuGrade(avg)

  return (
    <div className="td-screen">
      <div className="text-2xl td-strong mt-1.5 mb-1">Test Results</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{me?.klass ?? ''} · {me?.school ?? ''}</div>

      {stuResults.length === 0 ? (
        <div className="td-none">No results available yet</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="rounded-[18px] p-3.5 text-center" style={{ background: overall.t }}>
              <div className="text-2xl font-extrabold" style={{ color: overall.c }}>{overall.g}</div>
              <div className="text-[12px] font-semibold mt-1" style={{ color: overall.c, opacity: .7 }}>Overall grade</div>
            </div>
            <div className="td-card rounded-[18px] p-3.5 text-center">
              <div className="text-2xl td-strong">{avg}%</div>
              <div className="text-[12px] text-td-muted font-semibold mt-1">Average</div>
            </div>
          </div>

          <div className="td-h2">All subjects</div>
          <div className="flex flex-col gap-2.5">
            {stuResults.map((r, i) => {
              const pct = r.total > 0 ? Math.round((r.marks / r.total) * 100) : 0
              const g = stuGrade(pct)
              return (
                <div key={`${r.subject}-${r.test}-${i}`} className="td-card rounded-[18px] p-3.5">
                  <div className="flex items-center gap-[13px] mb-2.5">
                    <span className="text-[12px] font-extrabold py-[5px] px-2.5 rounded-[10px]" style={{ color: g.c, background: g.t }}>{g.g}</span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-bold text-td-dark">{r.subject}</div>
                      <div className="text-xs text-td-muted mt-0.5">{r.test} · {r.date}</div>
                    </div>
                    <div className="text-sm td-strong">{r.marks}/{r.total}</div>
                  </div>
                  <div className="w-full h-[7px] bg-td-soft rounded-full overflow-hidden">
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
  const { stuRankSubject, rankData, subjects: subjectsList, currentStudentDbId, set } = useDashboard()
  const me = useMe()
  const subjectNames = subjectsList.length ? subjectsList.map(s => s.name) : Object.keys(rankData)
  const rows = (rankData[stuRankSubject] || []).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, score: r.score }))
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const medals: IconName[] = ['silver', 'gold', 'bronze']
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
  const podiumHeights = [88, 110, 72]
  const podiumBg = ['#c0cfe8', 'var(--color-td-primary)', '#d4c9a8']
  // Silver, gold, bronze — podium order, not rank order.
  const MEDAL_INK = ['#8f9bb3', 'var(--color-td-amber)', '#b06a3a']

  return (
    <div className="td-screen">
      <div className="text-2xl td-strong mt-1.5 mb-1">Ranking</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{me?.klass ?? ''}{stuRankSubject ? ` · ${stuRankSubject}` : ''}</div>

      {subjectNames.length > 0 && (
        <div className="flex gap-[9px] overflow-x-auto mb-[22px] scrollbar-hide">
          {subjectNames.map(name => {
            const active = name === stuRankSubject
            return (
              <Chip key={name} active={active} onClick={() => set({ stuRankSubject: name })}>{name}</Chip>
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
                const isYou = p.id ? p.id === currentStudentDbId : me?.name === p.name
                return (
                  <div key={p.id ?? `${p.name}-${pi}`} className="flex flex-col items-center">
                    <Icon name={medals[pi]} size={26} className="mb-1" style={{ color: MEDAL_INK[pi] }} />
                    <div className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] mb-1.5" style={{ background: GRADIENTS[pi] }}>{initials(p.name)}</div>
                    <div className="text-[12px] td-strong text-center leading-tight mb-0.5">{p.name.split(' ')[0]}{isYou && <span className="text-td-primary"> (You)</span>}</div>
                    <div className="text-[12px] font-bold text-td-primary mb-1.5">{p.score}%</div>
                    <div className="w-[72px] rounded-t-[10px]" style={{ height: podiumHeights[pi], background: podiumBg[pi] }} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-[13px] td-strong mb-[11px]">Leaderboard</div>
          <div className="flex flex-col gap-[9px]">
            {rest.map((r, i) => {
              const isYou = r.id ? r.id === currentStudentDbId : me?.name === r.name
              return (
                <div key={r.id ?? `${r.name}-${i}`} className="flex items-center gap-[13px] border rounded-2xl p-3 px-3.5" style={{ background: isYou ? 'var(--color-td-tint-blue)' : 'var(--color-td-card)', borderColor: isYou ? 'var(--color-td-primary)' : 'var(--color-td-border)' }}>
                  <div className="w-[26px] text-center text-sm font-extrabold text-td-subtle">{r.rank}</div>
                  <div className="w-9 h-9 rounded-[11px] td-avatar" style={{ background: av(r.rank) }}>{initials(r.name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{r.name}{isYou && <span className="text-td-primary text-xs"> (You)</span>}</div>
                  <div className="text-sm td-strong">{r.score}%</div>
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
  const { teachers, timetableData, set, go } = useDashboard()

  // Who teaches *this child*, and what for. The child's timetable is already
  // filtered to their own class, so every period on it is theirs; the teacher's
  // name rides along at index 5. A period with no teacher set is skipped, which
  // is every period entered before the head had a teacher dropdown — those
  // students just see the branch directory, exactly as they do today.
  const mine = (() => {
    const subjects = new Map<string, Set<string>>()
    for (const periods of Object.values(timetableData))
      for (const p of periods)
        if (p[5]) subjects.set(p[5], (subjects.get(p[5]) ?? new Set()).add(p[2]))
    return teachers
      .filter(t => subjects.has(t.name))
      .map(t => ({ t, caption: [...subjects.get(t.name)!].sort().join(' · ') }))
  })()

  const row = (t: Teacher, caption: string) => (
    <button key={teacherKey(t)} onClick={() => { set({ stuTeacherId: teacherKey(t) }); go('stuTeacher', 'stuTeachers') }} className="text-left td-card rounded-[18px] p-3.5 flex items-center gap-3.5 cursor-pointer">
      <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: GRADIENTS[teachers.indexOf(t) % GRADIENTS.length] }}>{initials(t.name)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] td-strong">{t.name}</div>
        <div className="text-[12.5px] text-td-primary font-bold mt-0.5">{caption}</div>
        <div className="text-[12px] text-td-muted mt-[3px]">{t.experience} yrs · {t.qualification}</div>
      </div>
      <ChevronRight />
    </button>
  )

  return (
    <div className="td-screen">
      <div className="text-2xl td-strong mt-1.5 mb-1">Teachers</div>
      <div className="text-[12.5px] text-td-muted mb-[18px]">{teachers.length} faculty at your branch</div>

      {teachers.length === 0 ? (
        <div className="td-none">No teachers listed yet</div>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <div className="text-[13px] td-strong mb-2.5">Your teachers</div>
              <div className="flex flex-col gap-3 mb-6">{mine.map(m => row(m.t, m.caption))}</div>
              <div className="text-[13px] td-strong mb-2.5">Everyone at your branch</div>
            </>
          )}
          <div className="flex flex-col gap-3">{teachers.map(t => row(t, t.subject))}</div>
        </>
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
    <div className="td-screen">
      <ScreenHeader title="Teacher Profile" onBack={() => go('stuTeachers', 'stuTeachers')} />

      <div className="flex flex-col items-center mb-5">
        <div className="w-[80px] h-[80px] rounded-3xl flex items-center justify-center text-white font-extrabold text-[28px] mb-3" style={{ background: GRADIENTS[gradIdx % GRADIENTS.length] }}>{initials(t.name)}</div>
        <div className="text-[20px] td-strong">{t.name}</div>
        <span className="text-[12px] font-bold text-td-primary bg-td-tint-blue py-[5px] px-3 rounded-[20px] mt-2">{t.subject}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="td-card rounded-[18px] p-3.5 text-center">
          <div className="text-2xl td-strong">{t.experience}</div>
          <div className="text-[12px] text-td-muted font-semibold mt-1">Years exp.</div>
        </div>
        <div className="td-card rounded-[18px] p-3.5 text-center">
          <div className="text-2xl font-extrabold text-td-amber flex items-center justify-center gap-1.5"><Icon name="star" size={20} />{t.rating || '—'}</div>
          <div className="text-[12px] text-td-muted font-semibold mt-1">Rating</div>
        </div>
      </div>

      <div className="td-card rounded-[18px] p-4 mb-3">
        <div className="text-[13px] td-strong mb-2">Qualification</div>
        <div className="text-[13px] text-td-muted">{t.qualification}</div>
      </div>

      {t.about && (
        <div className="td-card rounded-[18px] p-4">
          <div className="text-[13px] td-strong mb-2">About</div>
          <div className="text-[13px] text-td-muted leading-relaxed">{t.about}</div>
        </div>
      )}
    </div>
  )
}

export function StuFeesScreen() {
  const { go, notify, stuFeeHistory, stuPendingFee, stuFeeSummary } = useDashboard()
  // Only worth saying when there is more than one installment behind the
  // number. "1 of 1 paid" under a single fee is a sentence that tells a parent
  // nothing they cannot already see.
  const plan = stuFeeSummary && stuFeeSummary.count > 1 ? stuFeeSummary : null

  return (
    <div className="td-screen">
      <ScreenHeader title="Fees" onBack={() => go('stuHome', 'stuHome')} />

      {stuPendingFee ? (
        <div className="rounded-[22px] p-5 text-white mb-5" style={{ background: 'linear-gradient(135deg,#e8553c,#ef7a64)' }}>
          <div className="text-xs opacity-70 font-semibold">{plan ? 'Next installment' : 'Amount due'}</div>
          <div className="text-[28px] font-extrabold mt-1">{stuPendingFee.amount}</div>
          <div className="text-[12.5px] opacity-80 mt-1">
            {stuPendingFee.period} · {stuPendingFee.overdue ? 'Was due' : 'Due'} {stuPendingFee.dueDate}
          </div>
          {plan && (
            <div className="text-[12px] opacity-80 mt-2 pt-2 border-t border-white/25">
              {plan.paidCount} of {plan.count} paid · {rupee(plan.outstanding)} left in total
            </div>
          )}
          <button onClick={() => notify('Contact your teacher to arrange payment')} className="w-full mt-4 border-none bg-td-card text-td-red text-sm font-extrabold py-3.5 rounded-[14px] cursor-pointer">Pay now</button>
        </div>
      ) : (
        <div className="rounded-[22px] p-5 text-white mb-5 text-center" style={{ background: 'linear-gradient(135deg,#2fa36b,#56c48d)' }}>
          <div className="text-[22px] font-extrabold">All clear!</div>
          <div className="text-[12.5px] opacity-80 mt-1">No pending fees</div>
        </div>
      )}

      <div className="td-h2">Payment history</div>
      {stuFeeHistory.length === 0 ? (
        <div className="td-none">No payment history yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuFeeHistory.map((f, i) => (
            <div key={`${f.period}-${i}`} className="td-row">
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-td-tint-green">
                <Icon name="check" size={18} color="var(--color-td-green)" />
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

  // Opening the feed is what clears the home-screen dot.
  const newest = stuNotifications[0]?.dbId
  useEffect(() => { if (newest) writeLocal('notif_seen_top', newest) }, [newest])

  return (
    <div className="td-screen">
      <ScreenHeader title="Notifications" onBack={() => go('stuHome', 'stuHome')} />

      {stuNotifications.length === 0 ? (
        <div className="td-none">No notifications yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuNotifications.map((n, i) => (
            <div key={`${n.dbId ?? ''}-${i}`} className="td-card rounded-[18px] p-3.5 flex items-start gap-[13px]">
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
    <div className="td-screen">
      <ScreenHeader title="My Timetable" onBack={() => go('stuHome', 'stuHome')} />

      <div className="flex gap-2 overflow-x-auto mb-[18px] scrollbar-hide">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
          const active = d === day
          return (
            <button key={d} onClick={() => setDay(d)} className={`shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-3 cursor-pointer text-center ${active ? 'bg-td-primary border-td-primary text-white' : 'bg-td-card border-td-border text-td-text'}`}>
              <div className="text-[12px] font-bold">{d}</div>
            </button>
          )
        })}
      </div>

      <div className="text-[13px] text-td-muted font-semibold mb-3.5">{dayNames[day]} · {periods.length} {periods.length === 1 ? 'class' : 'classes'}</div>

      {periods.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-10">No classes scheduled for {dayNames[day]}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {periods.map((p, i) => {
            const free = p[2] === 'Free period'
            return (
              <div key={`${p[0]}-${p[1]}-${p[2]}-${p[3]}-${i}`} className="td-row">
                <div className="text-center shrink-0 w-[56px]">
                  <div className="text-[12.5px] font-extrabold text-td-primary">{p[0]}</div>
                  <div className="text-[12px] text-td-subtle font-semibold">{p[1]}</div>
                </div>
                <div className="w-px h-[34px] bg-td-soft" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-bold" style={{ color: free ? 'var(--color-td-subtle)' : 'var(--color-td-dark)' }}>{p[2]}</div>
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
    <div className="td-screen">
      <ScreenHeader title="Homework" onBack={() => go('stuHome', 'stuHome')} />

      {stuAssignments.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-12 leading-relaxed">No homework assigned yet.<br />New assignments from your teacher will appear here.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {stuAssignments.map((a) => {
            const akey = `${a.due}-${a.subject}-${a.title}`
            return (
            <button key={akey} onClick={() => setOpen(open === akey ? null : akey)} className="w-full text-left td-card rounded-[18px] p-4 cursor-pointer">
              <div className="flex items-center gap-[13px]">
                <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-td-tint-amber" style={{ color: ink('var(--color-td-tint-amber)') }}><Icon name="homework" size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] td-strong">{a.title}</div>
                  <div className="text-[12px] text-td-muted mt-0.5">{a.subject}{a.due ? ` · due ${a.due}` : ''}</div>
                </div>
                {a.instructions && <Icon name="next" size={16} color="var(--color-td-faint)" className={`shrink-0 transition-transform ${open === akey ? 'rotate-90' : ''}`} />}
              </div>
              {open === akey && a.instructions && <div className="text-[13px] text-td-text leading-relaxed mt-3 pt-3 border-t border-td-line">{a.instructions}</div>}
            </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StuProfileScreen() {
  const { signOut, stuResults, googleEmail, notify, goFrom } = useDashboard()
  const me = useMe()
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
    <div className="td-screen">
      <div className="flex items-center justify-between mt-1.5 mb-[18px]">
        <div className="text-2xl td-strong">My Profile</div>
        <button onClick={signOut} className="td-danger text-[12.5px] font-bold py-2 px-3 rounded-[12px]">Sign out</button>
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
        <CodeCard
          className="rounded-[18px] mb-5"
          label="YOUR STUDENT CODE"
          code={me.id}
          hint="Use this to sign in on any device. Keep it private."
          onCopy={() => copyText(me.id, notify, 'Code copied!')}
        />
      )}

      <div className="flex flex-col gap-2.5 mb-5">
        {fields.map(f => (
          <div key={f.label} className="td-row">
            <Icon name={f.icon} size={20} className="text-td-muted shrink-0" />
            <div className="flex-1">
              <div className="text-[12px] text-td-subtle font-semibold">{f.label}</div>
              <div className="text-[13.5px] font-bold text-td-dark mt-0.5">{f.value}</div>
            </div>
            {f.locked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-faint)" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>}
          </div>
        ))}
      </div>

      <button
        onClick={() => goFrom('support', 'stuProfile', 'stuProfile')}
        className="td-row w-full text-left mb-5 cursor-pointer"
      >
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-td-tint-red"><Icon name="warning" size={20} /></div>
        <div className="flex-1 text-sm font-bold text-td-dark">Report a problem</div>
      </button>

      <div className="text-[12px] text-td-subtle text-center leading-relaxed">Your details are managed by your tuition centre and can&apos;t be changed here. Ask your teacher if something needs updating.</div>
    </div>
  )
}
