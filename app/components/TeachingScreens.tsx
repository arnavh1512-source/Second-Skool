'use client'

import { useEffect, useState } from 'react'
import { isoDay } from '../store/format'
import { useDashboard, REMINDER_TEMPLATES, initials, av, LIMITS, clampText, isWholeNumber } from '../store'
import { ScreenHeader, PrimaryButton, EmptyState, options, classesOf } from './Shell'
import { pickAttendanceClass } from '../lib/attendance'
import { Icon, type IconName } from './Icon'
import { findStudent, studentKey } from '../lib/student-key'

// Period labels that are not a subject. Matched exactly — see periodStyle.
const SPECIAL_PERIODS = new Set(['Test', 'Staff meeting', 'Parent meeting', 'Doubt session'])

export function TimetableScreen() {
  const { ttDay, timetableData, back, set, addTimetableEntry, deleteTimetableEntry, updateTimetableEntry, subjects, students, teachers, role, notify } = useDashboard()
  const isAdmin = role === 'admin'
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string[] | null>(null) // the original period being edited
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [room, setRoom] = useState('')
  // Who takes this period. Optional on purpose: every period entered before
  // this existed has no teacher, and the parent-facing screen falls back to
  // the branch directory rather than showing a gap.
  const [teacherId, setTeacherId] = useState('')
  const classes = classesOf(klass ? [...students, { klass }] : students)
  const selKlass = klass || classes[0] || ''
  const days = (() => {
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // back to this week's Monday
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((s, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i)
      return { s, d: String(d.getDate()) }
    })
  })()
  const dayNames: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }
  const periods = timetableData[ttDay] || []
  const subjectNames = subjects.map(s => s.name)

  const resetForm = () => { setStartTime('09:00'); setEndTime('10:00'); setSubject(''); setKlass(''); setRoom(''); setTeacherId(''); setShowForm(false); setEditing(null) }

  const handleAdd = async () => {
    // The class dropdown is empty until there are students, so this button was
    // pressable with nothing selected — and it returned in silence. A teacher
    // setting up a new centre tapped Save on a period she had filled in and
    // got no period, no error, and no idea which field was at fault.
    if (!selKlass) { notify('Add a student first — a period needs a class', 'error'); return }
    const subj = subject || subjectNames[0] || 'Free period'
    // Keep the form filled in when the write fails. Clearing it on the way out
    // meant a failed save cost her the times as well as the period.
    const ok = editing
      ? await updateTimetableEntry(ttDay, editing, startTime, endTime, subj, selKlass, room, teacherId)
      : await addTimetableEntry(ttDay, startTime, endTime, subj, selKlass, room, teacherId)
    if (ok) resetForm()
  }

  const startEdit = (p: string[]) => {
    setStartTime(p[0]); setEndTime(p[1]); setSubject(p[2]); setKlass(p[3]); setRoom(p[4] ?? '')
    setTeacherId(teachers.find(t => t.name === p[5])?.dbId ?? '')
    setEditing(p); setShowForm(true)
  }

  const periodStyle = (p: string[]) => {
    const free = p[2] === 'Free period'
    // Exact names, not substrings: a centre with a subject called "Test Prep"
    // or "Doubt Solving" had every one of its regular periods styled as a
    // one-off event on the timetable.
    const special = SPECIAL_PERIODS.has(p[2])
    return {
      dot: free ? 'var(--color-td-faint)' : special ? 'var(--color-td-amber)' : 'var(--color-td-primary)',
      bg: free ? 'var(--color-td-soft)' : '#fff',
      border: free ? 'var(--color-td-border)' : special ? 'var(--color-td-edge-amber)' : 'var(--color-td-edge-blue)',
      titleColor: free ? 'var(--color-td-subtle)' : 'var(--color-td-dark)',
      tag: free ? 'Free' : special ? 'Special' : 'Class',
      pillColor: free ? 'var(--color-td-subtle)' : special ? 'var(--color-td-amber)' : 'var(--color-td-primary)',
      pillBg: free ? 'var(--color-td-soft)' : special ? 'var(--color-td-tint-amber)' : 'var(--color-td-tint-blue)',
    }
  }

  return (
    <div className="td-screen td-wide">
      <ScreenHeader title="Timetable" onBack={back} right={isAdmin ? (
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} className="td-btn-sm">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      ) : undefined} />

      <div className="flex gap-2 overflow-x-auto mb-[18px] scrollbar-hide lg:hidden">
        {days.map(d => {
          const active = d.s === ttDay
          return (
            <button key={d.s} onClick={() => set({ ttDay: d.s })} className="shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-1.5 cursor-pointer text-center" style={{ background: active ? 'var(--color-td-primary)' : '#fff', borderColor: active ? 'var(--color-td-primary)' : 'var(--color-td-border)' }}>
              <div className="text-[12px] font-bold" style={{ color: active ? '#fff' : 'var(--color-td-text)' }}>{d.s}</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: active ? '#fff' : 'var(--color-td-text)' }}>{d.d}</div>
            </button>
          )
        })}
      </div>

      {isAdmin && showForm && (
        <div className="td-card rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5 lg:max-w-lg">
          <div className="text-sm td-strong">{editing ? 'Edit' : 'Add'} period — {dayNames[ttDay]}</div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="td-label">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="td-field text-sm focus:border-td-primary" />
            </div>
            <div><label className="td-label">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="td-field text-sm focus:border-td-primary" />
            </div>
          </div>
          <div><label className="td-label">Subject</label>
            <select value={subject || subjectNames[0] || 'Free period'} onChange={e => setSubject(e.target.value)} className="td-field text-[13.5px] bg-td-card">
              {subjectNames.map(s => <option key={s}>{s}</option>)}
              <option>Free period</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="td-label">Class</label>
              <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="td-field text-[13.5px] bg-td-card disabled:opacity-60">
                {options(classes, 'Add students first')}
              </select>
            </div>
            <div><label className="td-label">Room</label>
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 1" className="td-field text-sm focus:border-td-primary" />
            </div>
          </div>
          <div><label className="td-label">Teacher</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="td-field text-[13.5px] bg-td-card">
              <option value="">Not set</option>
              {teachers.map(t => <option key={t.dbId} value={t.dbId}>{t.name} &middot; {t.subject}</option>)}
            </select>
          </div>
          <PrimaryButton onClick={handleAdd}>{editing ? 'Save changes' : 'Add period'}</PrimaryButton>
        </div>
      )}

      {/* Desktop: full Mon–Sat week grid. Click a day header to target it for
          adding; edit/delete act on that day's period directly. */}
      <div className="hidden lg:grid grid-cols-6 gap-3">
        {days.map(d => {
          const ps = timetableData[d.s] || []
          return (
            <div key={d.s} className={`rounded-2xl border p-2.5 min-h-[130px] ${d.s === ttDay ? 'border-td-primary bg-td-soft' : 'border-td-border bg-td-card'}`}>
              <button onClick={() => set({ ttDay: d.s })} className="w-full text-center mb-2 cursor-pointer bg-transparent border-none">
                <div className="text-[12px] font-bold text-td-muted">{d.s}</div>
                <div className="text-[15px] td-strong">{d.d}</div>
              </button>
              {ps.length === 0 ? (
                <div className="text-center text-td-subtle text-[12px] py-3">—</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ps.map((p, i) => {
                    const s = periodStyle(p)
                    return (
                      <div key={`${p[0]}-${p[1]}-${p[2]}-${p[3]}-${i}`} className="rounded-[11px] border p-2" style={{ background: s.bg, borderColor: s.border }}>
                        <div className="text-[12px] font-bold text-td-muted">{p[0]}–{p[1]}</div>
                        <div className="text-[12px] font-extrabold leading-tight mt-0.5" style={{ color: s.titleColor }}>{p[2]}</div>
                        <div className="text-[12px] text-td-muted mt-0.5">{p[3]}{p[4] ? ` · ${p[4]}` : ''}</div>
                        {p[5] && <div className="text-[12px] text-td-primary font-semibold mt-0.5 truncate">{p[5]}</div>}
                        {isAdmin && (
                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => { set({ ttDay: d.s }); startEdit(p) }} className="flex-1 h-6 rounded-lg border border-td-edge-blue bg-td-tint-blue text-td-primary text-[12px] cursor-pointer">✎</button>
                            <button onClick={() => deleteTimetableEntry(d.s, p)} className="flex-1 h-6 rounded-lg td-danger text-[12px]">×</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="lg:hidden">
      <div className="text-[13px] text-td-muted font-semibold mb-3.5">{dayNames[ttDay]} · {periods.length} periods</div>

      {periods.length === 0 ? (
        <div className="td-none">No periods scheduled for {dayNames[ttDay]}</div>
      ) : (
        <div className="flex flex-col">
          {periods.map((p, i) => {
            const s = periodStyle(p)
            return (
              <div key={`${p[0]}-${p[1]}-${p[2]}-${p[3]}-${i}`} className="flex gap-[13px] items-stretch">
                <div className="shrink-0 w-[58px] text-right pt-1">
                  <div className="text-[12.5px] td-strong">{p[0]}</div>
                  <div className="text-[12px] text-td-subtle font-semibold">{p[1]}</div>
                </div>
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-[11px] h-[11px] rounded-full border-2 border-td-card" style={{ background: s.dot, boxShadow: `0 0 0 2px ${s.dot}` }} />
                  <div className="flex-1 w-0.5 bg-td-border" />
                </div>
                <div className="flex-1 pb-3.5">
                  <div className="rounded-2xl p-[13px] px-[15px] border" style={{ background: s.bg, borderColor: s.border }}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-sm font-extrabold" style={{ color: s.titleColor }}>{p[2]}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[12px] font-bold py-1 px-[9px] rounded-[20px]" style={{ color: s.pillColor, background: s.pillBg }}>{s.tag}</span>
                        {isAdmin && <button onClick={() => startEdit(p)} className="w-6 h-6 rounded-full border border-td-edge-blue bg-td-tint-blue text-td-primary flex items-center justify-center cursor-pointer text-[12px] leading-none">✎</button>}
                        {isAdmin && <button onClick={() => deleteTimetableEntry(ttDay, p)} className="w-6 h-6 rounded-full td-danger flex items-center justify-center text-[15px] leading-none">×</button>}
                      </div>
                    </div>
                    <div className="text-xs text-td-muted mt-1">{p[3]} · {p[4]}{p[5] ? ` · ${p[5]}` : ''}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

export function AttendanceScreen() {
  const { attClass, att, students, back, set, toggleAtt, saveAttendance, go, role } = useDashboard()
  const classes = classesOf(students)

  const selClass = pickAttendanceClass(classes, attClass)

  // att is keyed by the student, so a roster reorder can no longer move a mark
  // onto somebody else. Still cleared on a class change: the marks belong to the
  // class the teacher was looking at, and carrying them across is confusing even
  // now that it is no longer dangerous.
  useEffect(() => {
    if (selClass !== attClass) set({ attClass: selClass, att: {} })
  }, [selClass, attClass, set])

  // Student objects, not names — the roster is passed straight to saveAttendance,
  // which needs the database id. Resolving by name broke centres with two
  // students of the same name (both mapped to the first one's record).
  const roster = students.filter(s => s.klass === selClass)
  const absentCount = roster.reduce((a, s) => a + (att[studentKey(s)] === 'absent' ? 1 : 0), 0)
  const presentCount = roster.length - absentCount

  return (
    <div className="td-screen td-wide">
      <div className="flex items-center gap-3.5 mb-[18px]">
        <button onClick={back} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-dark)" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <div className="text-xl td-strong">Mark Attendance</div>
          <div className="text-xs text-td-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="No students yet"
          hint="Attendance is marked class by class. Add your students first and their classes will appear here."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <>
          <div className="flex gap-[9px] overflow-x-auto mb-4 scrollbar-hide">
            {classes.map(name => {
              const active = name === selClass
              return (
                <button key={name} onClick={() => set({ attClass: name, att: {} })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? 'var(--color-td-primary)' : '#fff', color: active ? '#fff' : 'var(--color-td-text)', borderColor: active ? 'var(--color-td-primary)' : 'var(--color-td-border)' }}>{name}</button>
              )
            })}
          </div>

          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 bg-td-tint-green rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-green">{presentCount}</div>
              <div className="text-[12px] text-td-on-green font-semibold">Present</div>
            </div>
            <div className="flex-1 bg-td-tint-red rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-red">{absentCount}</div>
              <div className="text-[12px] text-td-on-red font-semibold">Absent</div>
            </div>
          </div>

          <div className="text-xs text-td-subtle font-semibold mb-2.5">Tap a student to toggle present / absent</div>
          <div className="flex flex-col gap-[9px] mb-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            {roster.map((s, i) => {
              const key = studentKey(s)
              const absent = att[key] === 'absent'
              return (
                <button key={key || i} onClick={() => toggleAtt(key)} className="text-left border rounded-2xl p-3 px-3.5 flex items-center gap-[13px] cursor-pointer" style={{ background: absent ? 'var(--color-td-tint-red)' : '#fff', borderColor: absent ? 'var(--color-td-edge-red)' : 'var(--color-td-border)' }}>
                  <div className="w-[38px] h-[38px] rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(s.name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{s.name}</div>
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: absent ? 'var(--color-td-red)' : 'var(--color-td-green)' }}>
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: absent ? 'var(--color-td-red)' : 'var(--color-td-green)' }} />
                    {absent ? 'Absent' : 'Present'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="lg:max-w-xs"><PrimaryButton onClick={() => saveAttendance(roster)}>Save attendance</PrimaryButton></div>
        </>
      )}
    </div>
  )
}

export function ResultsScreen() {
  const { students, subjects, back, notify, go, role } = useDashboard()
  const [klass, setKlass] = useState('')
  const [subject, setSubject] = useState('')
  const [testName, setTestName] = useState('Unit Test')
  const [maxMarks, setMaxMarks] = useState('50')
  // Keyed by the student, never by their slot in the roster. Index-keyed marks
  // survived the class dropdown untouched, so numbers typed for one class sat in
  // the inputs of the next and published under those students, to every parent
  // in the class. Keying by student makes that structurally impossible; clearing
  // on a class change stops half-entered marks reappearing later.
  const [marks, setMarks] = useState<Record<string, string>>({})
  const classes = classesOf(students)
  const selKlass = klass || classes[0] || ''
  const roster = students.filter(s => s.klass === selKlass)
  const subjectNames = subjects.map(s => s.name)
  const selSubject = subject || subjectNames[0] || ''

  const handlePublish = async () => {
    if (!testName.trim()) { notify('Enter test name', 'error'); return }
    if (!selKlass) { notify('Add students first', 'error'); return }
    if (!selSubject) { notify('Add a subject first (More → Subjects)', 'error'); return }
    if (!isWholeNumber(maxMarks, 1, LIMITS.maxMarks)) { notify(`Max marks must be a whole number from 1 to ${LIMITS.maxMarks}`); return }
    const max = Number(maxMarks)

    // Validate every mark before writing anything. The old version ran Number(m)
    // straight into an int column, so 51/50 published, notified the class and
    // fed the ranking, and a stray letter became NaN. Marks are the most visible
    // thing a parent sees; a wrong one is not undone by an apology later.
    // Scoped to this roster: a key belonging to a student who has since moved
    // class or left must not slip into the publish.
    const entered = Object.entries(marks).filter(([key, m]) => m.trim() !== '' && !!findStudent(roster, key))
    if (!entered.length) { notify('Enter at least one mark', 'error'); return }
    for (const [key, m] of entered) {
      if (!isWholeNumber(m, 0, max)) {
        notify(`${findStudent(roster, key)?.name ?? 'A student'}: marks must be a whole number from 0 to ${max}`)
        return
      }
    }

    const { supabase } = await import('../lib/supabase')
    const subjectId = useDashboard.getState().subjects.find(s => s.name === selSubject)?.dbId
    const { data: test, error } = await supabase.from('tests').insert({
      name: clampText(testName, LIMITS.title), subject_id: subjectId ?? null, class: selKlass,
      // isoDay(), not toISOString(): the UTC day rolls at 05:30 IST, so a
      // test entered early in the morning was filed against yesterday.
      max_marks: max, date: isoDay(),
    }).select().single()
    if (error || !test) { notify('Could not publish — try again', 'error'); return }

    const resultRows = entered.map(([key, m]) => {
      const student = findStudent(roster, key)
      if (!student?.dbId) return null
      return { test_id: test.id, student_id: student.dbId, marks: Number(m) }
    }).filter((r): r is NonNullable<typeof r> => r !== null)

    // The marks are the point of the test row, so a failed results insert means
    // the publish failed. Drop the now-empty test instead of leaving an orphan,
    // and never claim success or notify the class — the previous version ignored
    // this error entirely and told the teacher, and every parent, that results
    // were published when nothing had been written.
    const { error: resultsError } = await supabase.from('results').insert(resultRows)
    if (resultsError) {
      await supabase.from('tests').delete().eq('id', test.id)
      notify('Could not publish results — nothing was saved', 'error')
      return
    }

    useDashboard.getState().notifyClass(selKlass, 'New results published', `${testName} · ${selSubject} — check your marks in the app`, 'results')
    notify('Results published & parents notified')
    setMarks({})
    // Rankings, the student's results screen and the reports all read from the
    // store snapshot, which knows nothing about marks written straight to
    // Postgres. Without this the teacher published a test and then found
    // "No results entered for Mathematics yet" on Rankings until she happened
    // to reload the page.
    await useDashboard.getState().refreshData()
  }

  return (
    <div className="td-wide td-screen">
      <ScreenHeader title="Enter Results" onBack={back} />

      <div className="grid grid-cols-2 gap-[11px] mb-[13px]">
        <div><label className="td-label">Class</label>
          <select value={selKlass} onChange={e => { setKlass(e.target.value); setMarks({}) }} className="td-field text-[13.5px] bg-td-card">
            {classes.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="td-label">Subject</label>
          <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={subjectNames.length === 0} className="td-field text-[13.5px] bg-td-card disabled:opacity-60">
            {options(subjectNames, 'Add subjects first')}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-[11px] mb-[18px]">
        <div><label className="td-label">Test name</label><input value={testName} onChange={e => setTestName(e.target.value)} className="td-field text-[13.5px] focus:border-td-primary" /></div>
        <div><label className="td-label">Max</label><input value={maxMarks} onChange={e => setMaxMarks(e.target.value)} className="td-field text-[13.5px] focus:border-td-primary" /></div>
      </div>

      <div className="td-h2">Enter marks</div>
      {roster.length === 0 ? (
        <EmptyState
          title={selKlass ? `No students in ${selKlass}` : 'No students in this class'}
          hint="Marks are entered per student. Add a student to this class and they will show up here."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <div className="flex flex-col gap-[9px] mb-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {roster.map((s, i) => (
            <div key={s.dbId ?? s.id ?? i} className="border border-td-border bg-td-card rounded-2xl p-[11px] px-3.5 flex items-center gap-[13px]">
              <div className="w-9 h-9 rounded-[11px] td-avatar" style={{ background: av(i) }}>{initials(s.name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{s.name}</div>
              <input value={marks[studentKey(s)] ?? ''} onChange={e => setMarks(m => ({ ...m, [studentKey(s)]: e.target.value }))} placeholder="—" className="w-[62px] text-center border border-td-border rounded-[11px] py-[9px] px-1.5 text-sm font-bold text-td-dark outline-none focus:border-td-primary" />
              <span className="text-[13px] text-td-subtle font-semibold">/{maxMarks}</span>
            </div>
          ))}
        </div>
      )}
      <div className="lg:max-w-xs"><PrimaryButton onClick={handlePublish}>Publish results</PrimaryButton></div>
    </div>
  )
}

export function AssignmentsScreen() {
  const { back, assignmentsList, saveAssignment, deleteAssignment, subjects, students, notify } = useDashboard()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const subjectNames = subjects.map(s => s.name)
  const selSubject = subject || subjectNames[0] || ''
  const classes = classesOf(students)
  const selKlass = klass || classes[0] || ''

  return (
    <div className="td-screen">
      <ScreenHeader title="New Assignment" onBack={back} />

      <div className="td-card rounded-[20px] p-[17px] mb-[22px] flex flex-col gap-3.5">
        <div><label className="td-label">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Algebra worksheet 5" className="td-field text-sm focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="td-label">Subject</label>
            <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={subjectNames.length === 0} className="td-field text-[13.5px] bg-td-card disabled:opacity-60">
              {options(subjectNames, 'Add subjects first')}
            </select>
          </div>
          <div><label className="td-label">Class</label>
            <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="td-field text-[13.5px] bg-td-card disabled:opacity-60">
              {options(classes, 'Add students first')}
            </select>
          </div>
        </div>
        <div><label className="td-label">Due date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="td-field text-sm focus:border-td-primary" /></div>
        <div><label className="td-label">Instructions</label><textarea rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Describe the task..." className="td-field text-sm resize-none focus:border-td-primary" /></div>
        <PrimaryButton onClick={async () => {
          // Same silent swallow as the timetable: with no students on the
          // roster the class select has nothing to offer, and Create used to
          // do nothing at all rather than say why.
          if (!selKlass) { notify('Add a student first — homework is set for a class', 'error'); return }
          if (await saveAssignment(title, selSubject, selKlass, dueDate, instructions)) { setTitle(''); setInstructions('') }
        }}>Create &amp; notify class</PrimaryButton>
      </div>

      <div className="td-h2">Active assignments</div>
      {assignmentsList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-4">No assignments yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignmentsList.map((a, i) => (
            <div key={a.dbId ?? `${a.title}-${a.due}-${i}`} className="td-card rounded-2xl p-3.5">
              <div className="flex justify-between items-start gap-2">
                <div className="text-[13.5px] font-bold text-td-dark">{a.title}</div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[12px] font-bold text-td-amber bg-td-tint-amber py-1 px-[9px] rounded-[20px] whitespace-nowrap">Due {a.due}</span>
                  {a.dbId && (
                    <button
                      onClick={() => deleteAssignment(a.dbId!)}
                      aria-label={`Delete assignment ${a.title}`}
                      className="border-none bg-transparent text-td-muted hover:text-td-red cursor-pointer p-1 leading-none text-base"
                    >×</button>
                  )}
                </div>
              </div>
              <div className="text-xs text-td-muted mt-[5px]">{a.klass} · {a.total} students</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RemindersScreen() {
  const { reminderType, back, set, saveReminder, reminderHistory, loadReminderHistory } = useDashboard()
  // Every send has been recorded since the first release; nothing ever showed
  // it back. Fetched on open rather than kept in the refresh cycle — it is
  // reference material, not something the rest of the app reads.
  useEffect(() => { loadReminderHistory() }, [loadReminderHistory])
  const [message, setMessage] = useState(REMINDER_TEMPLATES[reminderType] ?? '')
  const [filter, setFilter] = useState('all')
  const types: { key: string; label: string; icon: IconName }[] = [
    { key: 'Notice', label: 'Notice', icon: 'notice' },
    { key: 'Fee', label: 'Fees', icon: 'fees' },
    { key: 'Homework', label: 'Homework', icon: 'homework' },
    { key: 'Test', label: 'Test', icon: 'test' },
    { key: 'Absence', label: 'Absence', icon: 'absence' },
  ]

  return (
    <div className="td-screen">
      <ScreenHeader title="Send Reminder" onBack={back} />

      <label className="text-xs font-bold text-td-muted mb-2.5 block">Type</label>
      <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
        {types.map(r => {
          const active = r.key === reminderType
          return (
            <button key={r.key} onClick={() => { set({ reminderType: r.key }); setMessage(REMINDER_TEMPLATES[r.key] ?? '') }} className="border rounded-2xl p-3.5 cursor-pointer flex items-center gap-[11px]" style={{ background: active ? 'var(--color-td-tint-blue)' : '#fff', borderColor: active ? 'var(--color-td-primary)' : 'var(--color-td-border)' }}>
              <Icon name={r.icon} size={21} className="shrink-0" style={{ color: active ? 'var(--color-td-primary)' : 'var(--color-td-muted)' }} />
              <span className="text-[13.5px] font-bold" style={{ color: active ? 'var(--color-td-primary)' : 'var(--color-td-text)' }}>{r.label}</span>
            </button>
          )
        })}
      </div>

      <label className="td-label">Send to</label>
      <select value={filter} onChange={e => setFilter(e.target.value)} className="td-field text-[13.5px] bg-td-card mb-4">
        <option value="all">All students</option>
        <option value="absentees">Absentees only</option>
        <option value="fees_due">Students with fees due</option>
      </select>

      <label className="td-label">Message</label>
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} className="td-field text-sm resize-none mb-[18px] focus:border-td-primary" />

      <PrimaryButton onClick={async () => { await saveReminder(reminderType, message, 'all', filter); loadReminderHistory() }}>Send to students</PrimaryButton>

      <div className="text-[15px] td-strong mt-7 mb-3">Recently sent</div>
      {reminderHistory.length === 0 ? (
        <EmptyState title="Nothing sent yet" hint="Reminders you send appear here, so you can check what has already gone out before sending it again." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {reminderHistory.map(r => (
            <div key={r.dbId} className="td-card rounded-2xl p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11.5px] font-extrabold text-td-primary bg-td-tint-blue rounded-full py-[3px] px-2.5">{r.type}</span>
                <span className="text-[11.5px] text-td-muted">{r.when}</span>
              </div>
              <div className="text-[13px] text-td-dark leading-snug">{r.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
