'use client'

import { useState, useEffect } from 'react'
import { copyText } from '../lib/share'
import { useDashboard, initials, rupee, stuGrade, type Teacher } from '../store'
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
        <button onClick={() => { useDashboard.getState().signOut() }} className="td-plain self-start cursor-pointer flex items-center gap-1.5 text-td-muted text-td-small font-semibold mb-6">
          <Icon name="back" size={18} color="var(--color-td-muted)" />
          Back
        </button>
        <div className="w-[72px] h-[72px] rounded-td-lg bg-td-tint-blue flex items-center justify-center mb-5">
          <Icon name="students" size={32} color="var(--color-td-primary)" />
        </div>
        <div className="text-td-title td-strong mb-2">Link your account</div>
        <div className="text-td-small text-td-muted text-center leading-relaxed mb-6 max-w-[280px]">Enter the student code your teacher gave you to link your account and see your data.</div>
        <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())} placeholder="e.g. TUT-1234" className="td-field max-w-[260px] text-center tracking-wider font-semibold mb-4" />
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

  const monthAtt = stuMonthly && stuMonthly.attTotal > 0 ? stuMonthly : null

  return (
    <div className="td-screen">
      <div className="flex items-center justify-between gap-3 pb-[18px]">
        <div className="flex items-center gap-3 min-w-0">
          {centreLogo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={centreLogo} alt={centreName || 'Centre'} className="w-11 h-11 rounded-full object-cover border border-td-border shrink-0" />
            : <div className="w-11 h-11 rounded-full bg-td-tint-blue text-td-primary flex items-center justify-center text-td-small font-semibold shrink-0">{ini}</div>}
          <div className="min-w-0">
            <div className="text-td-title font-semibold tracking-[-.01em] text-td-dark truncate">{displayName}</div>
            <div className="td-num text-td-small text-td-muted mt-0.5 truncate">{[me?.klass, centreName].filter(Boolean).join(' · ') || 'Your centre'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle />
          <button onClick={() => go('stuNotif', 'stuHome')} aria-label={hasNewNotif ? 'Notifications, new' : 'Notifications'} className="relative td-icon-btn">
            <Icon name="reminder" size={20} color="var(--color-td-dark)" />
            {hasNewNotif && <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-td-red border-2 border-td-card" />}
          </button>
        </div>
      </div>

      {/* Money owed is the one thing on this screen with a deadline, so it sits
          above everything else instead of below the tiles. */}
      {stuPendingFee && (
        <button onClick={() => go('stuFees', 'stuHome')} className="td-plain w-full text-left cursor-pointer bg-td-tint-red border border-td-edge-red px-4 py-3.5 mb-[22px] flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-td-body font-semibold text-td-dark">Fee of {stuPendingFee.amount} is {stuPendingFee.overdue ? 'overdue' : 'due'}</div>
            <div className="text-td-body leading-[22px] text-td-text mt-[5px]">{stuPendingFee.overdue ? 'It was due on' : 'Pay by'} {stuPendingFee.dueDate}.</div>
          </div>
          <Icon name="next" size={18} color="var(--color-td-on-red)" className="shrink-0" />
        </button>
      )}

      <div className="flex items-center justify-between gap-2 mb-[18px]">
        <div className="inline-flex items-center gap-[7px] min-w-0">
          <Icon name="branches" size={14} color="var(--color-td-muted)" />
          <span className="text-td-small text-td-muted truncate">{me?.school || 'Your branch'}</span>
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
          }} className="inline-flex items-center gap-1.5 bg-td-card border border-td-border text-td-dark text-td-small font-semibold min-h-11 px-3 cursor-pointer shrink-0">
            <Icon name="reminder" size={14} color="var(--color-td-dark)" />
            Turn on alerts
          </button>
        )}
      </div>

      <div className="mb-3.5">
        <LastUpdated />
      </div>

      <div className="td-h2 mb-4">Attendance</div>
      <button onClick={() => go('stuAttendance', 'stuHome')} className="td-plain w-full text-left cursor-pointer block">
        <div className="flex items-end gap-4">
          <div className="td-num text-[40px] leading-10 font-semibold tracking-[-.03em] text-td-dark">{attendancePct === null ? '—' : `${attendancePct}%`}</div>
          <div className="pb-[3px] min-w-0">
            <div className="td-num text-td-body font-medium text-td-text">{attendancePct === null ? 'Not marked yet' : `${me?.attendanceMarked} ${me?.attendanceMarked === 1 ? 'session' : 'sessions'} marked`}</div>
            {monthAtt && <div className="td-num text-td-small text-td-muted mt-0.5">{monthAtt.attPresent} of {monthAtt.attTotal} this month</div>}
          </div>
        </div>
        {attendancePct !== null && (
          <div className="flex gap-0.5 mt-3.5" aria-hidden>
            {attendancePct > 0 && <div className="h-2 bg-td-green" style={{ flex: attendancePct }} />}
            {attendancePct < 100 && <div className="h-2 bg-td-red" style={{ flex: 100 - attendancePct }} />}
          </div>
        )}
      </button>

      <div className="td-h2 mt-6 mb-0">Standing</div>
      <button onClick={() => go('stuRanking', 'stuRanking')} className="td-plain w-full text-left cursor-pointer flex items-center gap-3 py-3 min-h-[52px] border-b border-td-line">
        <div className="flex-1 text-td-body font-medium text-td-dark">Class rank</div>
        <div className="td-num text-td-body font-semibold text-td-dark">
          {rankInfo.rank > 0 ? <>#{rankInfo.rank}<span className="text-td-muted font-normal"> / {rankInfo.total}</span></> : <span className="text-td-muted font-normal">No rank yet</span>}
        </div>
        <Icon name="next" size={16} color="var(--color-td-faint)" className="shrink-0" />
      </button>
      {stuMonthly && stuMonthly.tests > 0 && (
        <div className="flex items-center gap-3 py-3 min-h-[52px] border-b border-td-line">
          <div className="flex-1 text-td-body font-medium text-td-dark">Tests this month</div>
          <div className="td-num text-td-body font-semibold text-td-dark">{stuMonthly.tests}<span className="text-td-muted font-normal"> · avg {stuMonthly.avgPct}%</span></div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mt-[22px] mb-[22px]">
        {([
          { to: 'stuTimetable', icon: 'timetable', label: 'Timetable', badge: 0 },
          { to: 'stuAssignments', icon: 'homework', label: 'Homework', badge: 0 },
          { to: 'stuNotes', icon: 'notes', label: 'Material', badge: newNotes },
        ] as const).map(t => (
          <button key={t.to} onClick={() => go(t.to, 'stuHome')} className="relative text-left bg-td-card border border-td-border shadow-td-card p-3 min-h-14 cursor-pointer">
            <Icon name={t.icon} size={20} color="var(--color-td-dark)" />
            <div className="text-td-small font-semibold text-td-dark mt-2">{t.label}</div>
            {t.badge > 0 && <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-td-red text-td-on-solid text-td-caption font-semibold flex items-center justify-center">{t.badge}</span>}
          </button>
        ))}
      </div>

      {recentResults.length > 0 && (
        <div className="mb-[22px]">
          <div className="td-h2 mb-0">Latest marks</div>
          {recentResults.map((r, i) => (
            <div key={`${r.subject}-${r.test}-${i}`} className="flex items-center gap-3 py-3 min-h-[52px] border-b border-td-line">
              <div className="flex-1 min-w-0">
                <div className="text-td-body font-medium text-td-dark truncate">{r.subject}</div>
                <div className="td-num text-td-small text-td-muted mt-px truncate">{r.test} · {r.date}</div>
              </div>
              <div className="td-num text-td-body font-semibold text-td-dark">{r.marks}<span className="text-td-muted font-normal">/{r.total}</span></div>
            </div>
          ))}
        </div>
      )}

      {stuReminders.length > 0 && (
        <>
          <div className="td-h2 mb-0">From the centre</div>
          {stuReminders.map((r, i) => (
            <button key={`${r.dbId ?? ''}-${i}`} onClick={() => go('stuNotif', 'stuHome')} className="td-plain w-full text-left cursor-pointer flex items-center gap-3 py-3 min-h-14 border-b border-td-line">
              <div className="flex-1 min-w-0">
                <div className="text-td-body font-semibold text-td-dark">{r.title}</div>
                <div className="text-td-small text-td-text mt-0.5 truncate">{r.detail}</div>
              </div>
              <span className="td-num text-td-small text-td-muted shrink-0">{r.when}</span>
            </button>
          ))}
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

  return (
    <div className="td-screen">
      <ScreenHeader title="Attendance" onBack={() => go('stuHome', 'stuHome')} />

      <div className="td-h2 mb-4">Present overall</div>
      {total > 0 ? (
        <div className="mb-6">
          <div className="flex items-end gap-4">
            <div className="td-num text-[40px] leading-10 font-semibold tracking-[-.03em] text-td-dark">{pct}%</div>
            <div className="pb-[3px] min-w-0">
              <div className="td-num text-td-body font-medium text-td-text">{present} of {total} class days</div>
              {recent > 0 && <div className="td-num text-td-small text-td-muted mt-0.5">{absent} absences, {leaves} leaves in the last {recent} days</div>}
            </div>
          </div>
          <div className="flex gap-0.5 h-2 mt-3.5" aria-hidden>
            {pct > 0 && <div className="bg-td-green" style={{ flex: pct }} />}
            {pct < 100 && <div className="bg-td-red" style={{ flex: 100 - pct }} />}
          </div>
        </div>
      ) : (
        <div className="td-none">No attendance data yet.</div>
      )}

      <div className="td-h2 mb-0">Recent days</div>
      {stuAttendanceLog.length === 0 ? (
        <div className="td-none">No attendance records yet</div>
      ) : stuAttendanceLog.map((d, i) => (
        <div key={`${d.date}-${i}`} className="td-row">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ background: d.tint, color: ink(d.tint) }}><DataIcon value={d.icon} size={20} /></div>
          <div className="flex-1">
            <div className="text-td-body font-medium text-td-dark">{d.day}</div>
            <div className="td-num text-td-small text-td-muted mt-px">{d.date}</div>
          </div>
          <span className="text-td-small font-semibold" style={{ color: ink(d.tint) }}>{d.status}</span>
        </div>
      ))}
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
      <div className="td-title mt-1.5 mb-1">Test results</div>
      <div className="text-td-caption text-td-muted mb-[18px]">{me?.klass ?? ''} · {me?.school ?? ''}</div>

      {stuResults.length === 0 ? (
        <div className="td-none">No results available yet</div>
      ) : (
        <>
          <div className="td-h2 mb-4">Average</div>
          <div className="flex items-end gap-4 mb-6">
            <div className="td-num text-[40px] leading-10 font-semibold tracking-[-.03em] text-td-dark">{avg}%</div>
            <span className={`td-tag px-[7px] py-[3px] mb-[5px] ${overall.tag}`}>Grade {overall.g}</span>
          </div>

          <div className="td-h2 mb-0">All subjects</div>
          {stuResults.map((r, i) => {
            const pct = r.total > 0 ? Math.round((r.marks / r.total) * 100) : 0
            const g = stuGrade(pct)
            return (
              <div key={`${r.subject}-${r.test}-${i}`} className="py-3 border-b border-td-line">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-td-body font-medium text-td-dark truncate">{r.subject}</div>
                    <div className="td-num text-td-small text-td-muted mt-px truncate">{r.test} · {r.date}</div>
                  </div>
                  <div className="td-num text-td-body font-semibold text-td-dark">{r.marks}<span className="text-td-muted font-normal">/{r.total}</span></div>
                  <span className={`td-tag px-[7px] py-[3px] ${g.tag}`}>{g.g}</span>
                </div>
                <div className="h-1 bg-td-soft" aria-hidden>
                  <div className={`h-full ${g.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

export function StuRankingScreen() {
  const { stuRankSubject, rankData, subjects: subjectsList, currentStudentDbId, set } = useDashboard()
  const me = useMe()
  // Same rule as the staff board: a chip for a subject this child's class does
  // not sit is a chip that opens on nothing.
  const named = subjectsList.map(s => s.name).filter(n => (rankData[n]?.length ?? 0) > 0)
  const subjectNames = named.length ? named : Object.keys(rankData)
  const activeSubject = subjectNames.includes(stuRankSubject) ? stuRankSubject : (subjectNames[0] ?? '')
  const rows = (rankData[activeSubject] || []).map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, score: r.score }))
  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const isYou = (r: { id: string | null; name: string }) => r.id ? r.id === currentStudentDbId : me?.name === r.name
  const line = (r: typeof rows[number]) => (
    <div key={r.id ?? `${r.name}-${r.rank}`} className={`flex items-center gap-3 py-3 min-h-[52px] border-b border-td-line ${isYou(r) ? 'bg-td-tint-blue -mx-2 px-2' : ''}`}>
      <div className="td-num w-6 text-td-small font-semibold text-td-muted">{r.rank}</div>
      <div className="w-9 h-9 td-avatar">{initials(r.name)}</div>
      <div className="flex-1 min-w-0 text-td-body font-medium text-td-dark truncate">{r.name}{isYou(r) && <span className="text-td-primary"> (You)</span>}</div>
      <div className="td-num text-td-body font-semibold text-td-dark">{r.score}%</div>
    </div>
  )

  return (
    <div className="td-screen">
      <div className="td-title mt-1.5 mb-1">Ranking</div>
      <div className="text-td-caption text-td-muted mb-[18px]">{me?.klass ?? ''}{activeSubject ? ` · ${activeSubject}` : ''}</div>

      {subjectNames.length > 0 && (
        <div className="flex flex-wrap gap-[7px] mb-5">
          {subjectNames.map(name => {
            const active = name === activeSubject
            return (
              <Chip key={name} active={active} onClick={() => set({ stuRankSubject: name })}>{name}</Chip>
            )
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="td-none leading-relaxed">No rankings published yet.<br />They&apos;ll appear once your teacher enters results.</div>
      ) : (
        <>
          <div className="td-h2 mb-0">Top three</div>
          <div className="mb-6">{top3.map(line)}</div>
          {rest.length > 0 && (
            <>
              <div className="td-h2 mb-0">Rest of class</div>
              {rest.map(line)}
            </>
          )}
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
    <button key={teacherKey(t)} onClick={() => { set({ stuTeacherId: teacherKey(t) }); go('stuTeacher', 'stuTeachers') }} className="td-plain w-full text-left flex items-center gap-3 py-3 min-h-14 border-b border-td-line cursor-pointer">
      <div className="w-11 h-11 td-avatar">{initials(t.name)}</div>
      <div className="flex-1 min-w-0">
        <div className="text-td-body font-medium text-td-dark truncate">{t.name}</div>
        <div className="text-td-small text-td-primary mt-px truncate">{caption}</div>
        <div className="td-num text-td-small text-td-muted mt-px truncate">{t.experience} yrs · {t.qualification}</div>
      </div>
      <ChevronRight />
    </button>
  )

  return (
    <div className="td-screen">
      <div className="td-title mt-1.5 mb-1">Teachers</div>
      <div className="text-td-caption text-td-muted mb-[18px]">{teachers.length} faculty at your branch</div>

      {teachers.length === 0 ? (
        <div className="td-none">No teachers listed yet</div>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <div className="td-h2 mb-0">Your teachers</div>
              <div className="mb-6">{mine.map(m => row(m.t, m.caption))}</div>
              <div className="td-h2 mb-0">Everyone at your branch</div>
            </>
          )}
          {teachers.map(t => row(t, t.subject))}
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
  if (!t) return <div className="text-center text-td-muted py-8">No teacher data</div>

  return (
    <div className="td-screen">
      <ScreenHeader title="Teacher Profile" onBack={() => go('stuTeachers', 'stuTeachers')} />

      <div className="flex flex-col items-center mb-5">
        <div className="w-20 h-20 td-avatar text-td-display mb-3">{initials(t.name)}</div>
        <div className="text-td-heading td-strong">{t.name}</div>
        <span className="td-tag px-[7px] py-[3px] bg-td-tint-blue text-td-primary mt-2">{t.subject}</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <div className="td-stat">
          <div className="td-num text-td-heading td-strong">{t.experience}</div>
          <div className="text-td-caption text-td-muted font-semibold mt-1">Years exp.</div>
        </div>
        <div className="td-stat">
          <div className="td-num text-td-heading font-semibold text-td-on-amber flex items-center justify-center gap-1.5"><Icon name="star" size={20} />{t.rating || '—'}</div>
          <div className="text-td-caption text-td-muted font-semibold mt-1">Rating</div>
        </div>
      </div>

      <div className="td-card p-4 mb-3">
        <div className="text-td-small td-strong mb-2">Qualification</div>
        <div className="text-td-small text-td-muted">{t.qualification}</div>
      </div>

      {t.about && (
        <div className="td-card p-4">
          <div className="text-td-small td-strong mb-2">About</div>
          <div className="text-td-small text-td-muted leading-relaxed">{t.about}</div>
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
        <div className="bg-td-card border border-td-border shadow-td-card p-4 mb-6">
          <div className="text-td-caption font-semibold tracking-[.12em] uppercase text-td-muted">{plan ? 'Next installment' : 'Amount due'}</div>
          <div className="td-num text-[40px] leading-10 font-semibold tracking-[-.03em] text-td-on-red mt-[9px]">{stuPendingFee.amount}</div>
          <div className="td-num text-td-small text-td-muted mt-2">
            {stuPendingFee.period} · {stuPendingFee.overdue ? 'Was due' : 'Due'} {stuPendingFee.dueDate}
          </div>
          {plan && (
            <div className="td-num text-td-small text-td-text mt-3 pt-3 border-t border-td-line">
              {plan.paidCount} of {plan.count} paid · {rupee(plan.outstanding)} left in total
            </div>
          )}
          <button onClick={() => notify('Contact your teacher to arrange payment')} className="w-full mt-4 min-h-11 border-none bg-td-dark text-td-bg text-td-small font-semibold cursor-pointer">Pay now</button>
        </div>
      ) : (
        <div className="bg-td-card border border-td-border shadow-td-card p-4 mb-6">
          <div className="text-td-title font-semibold text-td-on-green">All clear</div>
          <div className="text-td-small text-td-muted mt-1">No pending fees</div>
        </div>
      )}

      <div className="td-h2 mb-0">Payment history</div>
      {stuFeeHistory.length === 0 ? (
        <div className="td-none">No payment history yet</div>
      ) : stuFeeHistory.map((f, i) => (
        <div key={`${f.period}-${i}`} className="td-row">
          <div className="flex-1 min-w-0">
            <div className="text-td-body font-medium text-td-dark">{f.period}</div>
            <div className="td-num text-td-small text-td-muted mt-px">Paid on {f.date}</div>
          </div>
          <div className="td-num text-td-body font-semibold text-td-on-green">{f.amount}</div>
        </div>
      ))}
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
        stuNotifications.map((n, i) => (
          <div key={`${n.dbId ?? ''}-${i}`} className="flex items-start gap-3 py-3 border-b border-td-line">
            <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ background: n.tint, color: ink(n.tint) }}><DataIcon value={n.icon} size={20} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-td-body font-semibold text-td-dark">{n.title}</div>
              <div className="text-td-small text-td-text mt-0.5 leading-relaxed">{n.detail}</div>
              <div className="td-num text-td-small text-td-muted mt-1">{n.when}</div>
            </div>
          </div>
        ))
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
            <button key={d} onClick={() => setDay(d)} className={`shrink-0 min-w-12 min-h-11 border py-[9px] px-3 cursor-pointer text-center ${active ? 'bg-td-dark text-td-bg border-td-dark' : 'bg-td-card border-td-border text-td-text'}`}>
              <div className="text-td-caption font-semibold">{d}</div>
            </button>
          )
        })}
      </div>

      <div className="text-td-small text-td-muted font-semibold mb-3.5">{dayNames[day]} · {periods.length} {periods.length === 1 ? 'class' : 'classes'}</div>

      {periods.length === 0 ? (
        <div className="td-none">No classes scheduled for {dayNames[day]}</div>
      ) : periods.map((p, i) => (
        <div key={`${p[0]}-${p[1]}-${p[2]}-${p[3]}-${i}`} className="td-row">
          <div className="td-num shrink-0 w-14">
            <div className="text-td-small font-semibold text-td-dark">{p[0]}</div>
            <div className="text-td-small text-td-muted">{p[1]}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-td-body font-medium ${p[2] === 'Free period' ? 'text-td-subtle' : 'text-td-dark'}`}>{p[2]}</div>
            {p[4] && <div className="text-td-small text-td-muted mt-px">{p[4]}</div>}
          </div>
        </div>
      ))}
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
        <div className="td-none leading-relaxed">No homework assigned yet.<br />New assignments from your teacher will appear here.</div>
      ) : (
        <div>
          {stuAssignments.map((a) => {
            const akey = `${a.due}-${a.subject}-${a.title}`
            return (
            <button key={akey} onClick={() => setOpen(open === akey ? null : akey)} className="td-plain w-full text-left py-3 border-b border-td-line cursor-pointer">
              <div className="flex items-center gap-3 min-h-11">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-td-tint-amber" style={{ color: ink('var(--color-td-tint-amber)') }}><Icon name="homework" size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-td-body font-medium text-td-dark">{a.title}</div>
                  <div className="td-num text-td-small text-td-muted mt-px">{a.subject}{a.due ? ` · due ${a.due}` : ''}</div>
                </div>
                {a.instructions && <Icon name="next" size={16} color="var(--color-td-faint)" className={`shrink-0 transition-transform ${open === akey ? 'rotate-90' : ''}`} />}
              </div>
              {open === akey && a.instructions && <div className="text-td-small text-td-text leading-relaxed mt-3 pt-3 border-t border-td-line">{a.instructions}</div>}
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
        <div className="td-title">My Profile</div>
        <button onClick={signOut} className="td-danger text-td-small font-semibold min-h-11 px-3">Sign out</button>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 td-avatar text-td-heading">{ini}</div>
        <div className="min-w-0">
          <div className="text-td-title font-semibold text-td-dark truncate">{displayName}</div>
          <div className="td-num text-td-small text-td-muted mt-0.5">{me?.klass ?? ''}</div>
          {stuResults.length > 0 && (
            <span className={`inline-block td-tag px-[7px] py-[3px] mt-1.5 ${grade.tag}`}>{grade.g} · {avg}%</span>
          )}
        </div>
      </div>

      {/* The code is how a student signs back in — on a new phone, after
          clearing the browser, after a reinstall. It's issued once at
          registration and then only ever lived in a toast, so anyone who
          didn't write it down was locked out. It belongs here permanently. */}
      {me?.id && (
        <CodeCard
          className="mb-5"
          label="YOUR STUDENT CODE"
          code={me.id}
          hint="Use this to sign in on any device. Keep it private."
          onCopy={() => copyText(me.id, notify, 'Code copied!')}
        />
      )}

      <div className="mb-5">
        {fields.map(f => (
          <div key={f.label} className="td-row">
            <Icon name={f.icon} size={20} className="text-td-muted shrink-0" />
            <div className="flex-1">
              <div className="text-td-small text-td-muted">{f.label}</div>
              <div className="text-td-body font-medium text-td-dark mt-px">{f.value}</div>
            </div>
            {f.locked && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-faint)" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>}
          </div>
        ))}
      </div>

      <button
        onClick={() => goFrom('support', 'stuProfile', 'stuProfile')}
        className="td-plain td-row w-full text-left mb-5 cursor-pointer"
      >
        <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-td-tint-red text-td-on-red"><Icon name="warning" size={20} /></div>
        <div className="flex-1 text-td-body font-medium text-td-dark">Report a problem</div>
      </button>

      <div className="text-td-caption text-td-subtle text-center leading-relaxed">Your details are managed by your tuition centre and can&apos;t be changed here. Ask your teacher if something needs updating.</div>
    </div>
  )
}
