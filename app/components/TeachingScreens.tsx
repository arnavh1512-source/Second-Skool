'use client'

import { useEffect, useState } from 'react'
import { isoDay, parseDay } from '../store/format'
import { useDashboard, REMINDER_TEMPLATES, initials, av, LIMITS, clampText, isWholeNumber } from '../store'
import { ScreenHeader, PrimaryButton, EmptyState, options, classesOf } from './Shell'
import { Icon, type IconName } from './Icon'
import { findStudent, studentKey } from '../lib/student-key'
import { changedMarks, writeOrder } from '../lib/results-edit'

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
      bg: free ? 'var(--color-td-soft)' : 'var(--color-td-card)',
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
            <button key={d.s} onClick={() => set({ ttDay: d.s })} className={`shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-1.5 cursor-pointer text-center ${active ? 'bg-td-primary border-td-primary text-white' : 'bg-td-card border-td-border text-td-text'}`}>
              <div className="text-[12px] font-bold">{d.s}</div>
              <div className="text-sm font-extrabold mt-0.5">{d.d}</div>
            </button>
          )
        })}
      </div>

      {isAdmin && showForm && (
        <div className="td-form-card mb-[18px] lg:max-w-lg">
          <div className="text-sm td-strong">{editing ? 'Edit' : 'Add'} period — {dayNames[ttDay]}</div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="td-label">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="td-field text-sm" />
            </div>
            <div><label className="td-label">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="td-field text-sm" />
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
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 1" className="td-field text-sm" />
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
              <button onClick={() => set({ ttDay: d.s })} className="td-plain w-full text-center mb-2 cursor-pointer">
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

// A test that has already gone out to the class. Read back from the database
// rather than kept in the store: nothing else in a staff session needs the
// list, and loading it on every refresh for the one screen that opens it would
// be a query the other twenty screens pay for.
interface PublishedTest { id: string; name: string; klass: string; subject: string; max: number; date: string }

// The twenty most recent tests in the centre, RLS-scoped like every other
// staff read. Outside the component so the effect that loads it sets state in a
// callback rather than in the effect body.
async function fetchTests(): Promise<PublishedTest[]> {
  const { supabase } = await import('../lib/supabase')
  const { data } = await supabase.from('tests')
    .select('id,name,class,date,max_marks,subject_id').order('date', { ascending: false }).limit(20)
  const subjects = useDashboard.getState().subjects
  return (data ?? []).map(t => ({
    id: t.id as string, name: t.name as string, klass: (t.class as string) ?? '',
    subject: subjects.find(s => s.dbId === t.subject_id)?.name ?? '',
    max: t.max_marks as number, date: (t.date as string) ?? '',
  }))
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
  // The published tests, and — while one is open — the marks it already holds,
  // so an edit can tell a corrected mark from one nobody touched.
  const [tests, setTests] = useState<PublishedTest[]>([])
  const [editing, setEditing] = useState<PublishedTest | null>(null)
  const [published, setPublished] = useState<Record<string, number>>({})
  const classes = classesOf(students)
  const selKlass = editing ? editing.klass : (klass || classes[0] || '')
  const roster = students.filter(s => s.klass === selKlass)
  const subjectNames = subjects.map(s => s.name)
  const selSubject = editing ? editing.subject : (subject || subjectNames[0] || '')

  useEffect(() => {
    let alive = true
    fetchTests().then(t => { if (alive) setTests(t) })
    return () => { alive = false }
  }, [])

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
    setTests(await fetchTests())
    // Rankings, the student's results screen and the reports all read from the
    // store snapshot, which knows nothing about marks written straight to
    // Postgres. Without this the teacher published a test and then found
    // "No results entered for Mathematics yet" on Rankings until she happened
    // to reload the page.
    await useDashboard.getState().refreshData()
  }

  // Open a published test for correction. The marks already recorded are read
  // back and shown in the boxes, so the teacher is editing the thing the
  // parents can see rather than typing a class in again from memory.
  const openTest = async (t: PublishedTest) => {
    const { supabase } = await import('../lib/supabase')
    const { data, error } = await supabase.from('results').select('student_id,marks').eq('test_id', t.id)
    if (error) { notify('Could not open this test — try again', 'error'); return }
    const byStudent = new Map((data ?? []).map(r => [r.student_id as string, r.marks as number]))
    const typed: Record<string, string> = {}
    const already: Record<string, number> = {}
    for (const s of students.filter(x => x.klass === t.klass)) {
      const m = s.dbId ? byStudent.get(s.dbId) : undefined
      if (m === undefined) continue
      typed[studentKey(s)] = String(m)
      already[studentKey(s)] = m
    }
    setEditing(t); setPublished(already); setMarks(typed)
    setTestName(t.name); setMaxMarks(String(t.max))
  }

  const closeTest = () => {
    setEditing(null); setPublished({}); setMarks({})
    setTestName('Unit Test'); setMaxMarks('50')
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!testName.trim()) { notify('Enter test name', 'error'); return }
    if (!isWholeNumber(maxMarks, 1, LIMITS.maxMarks)) { notify(`Max marks must be a whole number from 1 to ${LIMITS.maxMarks}`); return }
    const max = Number(maxMarks)

    const entries = roster.filter(s => s.dbId).map(s => ({
      studentId: s.dbId as string, name: s.name,
      typed: marks[studentKey(s)] ?? '', published: published[studentKey(s)] ?? null,
    }))
    for (const e of entries) {
      if (e.typed.trim() === '') continue
      if (!isWholeNumber(e.typed, 0, max)) { notify(`${e.name}: marks must be a whole number from 0 to ${max}`); return }
    }

    const rows = changedMarks(editing.id, entries)
    const name = clampText(testName, LIMITS.title)
    const testChanged = name !== editing.name || max !== editing.max
    if (!rows.length && !testChanged) { notify('Nothing to save — no mark was changed'); return }

    const { supabase } = await import('../lib/supabase')
    const writeTest = async () => testChanged
      ? supabase.from('tests').update({ name, max_marks: max }).eq('id', editing.id)
      : { error: null }
    const writeMarks = async () => rows.length
      ? supabase.from('results').upsert(rows, { onConflict: 'test_id,student_id' })
      : { error: null }

    // The maximum and the marks are guarded against each other in both
    // directions, so whichever one is moving into the space of the other has to
    // go second. See writeOrder.
    const testFirst = writeOrder(editing.max, max) === 'test-first'
    const { error: firstError } = testFirst ? await writeTest() : await writeMarks()
    if (firstError) { notify('Could not save the correction — nothing was changed', 'error'); return }
    const { error: secondError } = testFirst ? await writeMarks() : await writeTest()
    // Half of an edit landed. Saying "saved" here would leave a mark on screen
    // that no parent can see, which is the exact failure this screen exists to
    // prevent.
    if (secondError) { notify('Only part of the change was saved — open the test again and check', 'error'); setTests(await fetchTests()); return }

    // A mark that changes in silence is worse than one that was wrong: the
    // parent saw the first number and has no reason to look again.
    useDashboard.getState().notifyClass(editing.klass, 'Results updated',
      `${name}${editing.subject ? ` · ${editing.subject}` : ''} — marks were corrected, check the app`, 'results')
    notify('Correction saved & parents notified')
    closeTest()
    setTests(await fetchTests())
    await useDashboard.getState().refreshData()
  }

  return (
    <div className="td-wide td-screen">
      <ScreenHeader title={editing ? 'Edit Results' : 'Enter Results'} onBack={editing ? closeTest : back} />

      <div className="grid grid-cols-2 gap-[11px] mb-[13px]">
        <div><label className="td-label">Class</label>
          {/* Locked while editing: the test belongs to a class, and moving it to
              another one would hand a set of marks to students who never sat it. */}
          <select value={selKlass} disabled={!!editing} onChange={e => { setKlass(e.target.value); setMarks({}) }} className="td-field text-[13.5px] bg-td-card disabled:opacity-60">
            {editing ? <option>{editing.klass}</option> : classes.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="td-label">Subject</label>
          <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={!!editing || subjectNames.length === 0} className="td-field text-[13.5px] bg-td-card disabled:opacity-60">
            {editing ? <option>{editing.subject || '—'}</option> : options(subjectNames, 'Add subjects first')}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-[11px] mb-[18px]">
        <div><label className="td-label">Test name</label><input value={testName} onChange={e => setTestName(e.target.value)} className="td-field text-[13.5px]" /></div>
        <div><label className="td-label">Max</label><input value={maxMarks} onChange={e => setMaxMarks(e.target.value)} className="td-field text-[13.5px]" /></div>
      </div>

      <div className="td-h2">{editing ? 'Correct marks' : 'Enter marks'}</div>
      {editing && (
        <div className="text-[12.5px] text-td-subtle mb-2.5">
          A published mark can be corrected but never removed — clearing a box leaves that mark as it is. The class is told when you save.
        </div>
      )}
      {roster.length === 0 ? (
        <EmptyState
          title={selKlass ? `No students in ${selKlass}` : 'No students in this class'}
          hint="Marks are entered per student. Add a student to this class and they will show up here."
          actionLabel={role === 'admin' ? 'Add a student' : undefined}
          onAction={role === 'admin' ? () => go('addStudent', 'students') : undefined}
        />
      ) : (
        <div className="td-list gap-[9px] mb-5">
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
      <div className="lg:max-w-xs">
        <PrimaryButton onClick={editing ? handleSaveEdit : handlePublish}>{editing ? 'Save correction' : 'Publish results'}</PrimaryButton>
      </div>

      {/* Published tests were write-once until now: a wrong mark could only be
          fixed by deleting the whole test out of the database, taking the rest
          of the class with it. */}
      {!editing && tests.length > 0 && (
        <>
          <div className="td-h2 mt-[26px]">Published tests</div>
          <div className="text-[12.5px] text-td-subtle mb-2.5">Tap a test to correct a mark. Nothing here can be deleted.</div>
          <div className="td-list gap-[9px]">
            {tests.map(t => {
              const d = parseDay(t.date)
              return (
                <button key={t.id} onClick={() => openTest(t)} className="w-full text-left td-card rounded-2xl p-[11px] px-3.5 flex items-center gap-3 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold text-td-dark truncate">{t.name}</div>
                    <div className="text-[12px] text-td-muted">
                      {t.klass}{t.subject ? ` · ${t.subject}` : ''} · out of {t.max}{d ? ` · ${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}` : ''}
                    </div>
                  </div>
                  <span className="text-[12.5px] text-td-primary font-semibold shrink-0">Edit</span>
                </button>
              )
            })}
          </div>
        </>
      )}
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

      <div className="td-form-card mb-[22px]">
        <div><label className="td-label">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Algebra worksheet 5" className="td-field text-sm" /></div>
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
        <div><label className="td-label">Due date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="td-field text-sm" /></div>
        <div><label className="td-label">Instructions</label><textarea rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Describe the task..." className="td-field text-sm resize-none" /></div>
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
                      className="td-plain text-td-muted hover:text-td-red cursor-pointer p-1 leading-none text-base"
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
            <button key={r.key} onClick={() => { set({ reminderType: r.key }); setMessage(REMINDER_TEMPLATES[r.key] ?? '') }} className="border rounded-2xl p-3.5 cursor-pointer flex items-center gap-[11px]" style={{ background: active ? 'var(--color-td-tint-blue)' : 'var(--color-td-card)', borderColor: active ? 'var(--color-td-primary)' : 'var(--color-td-border)' }}>
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
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} className="td-field text-sm resize-none mb-[18px]" />

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
