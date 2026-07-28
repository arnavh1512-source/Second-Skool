'use client'

import { useState } from 'react'
import { useDashboard, REMINDER_TEMPLATES, initials, av } from '../store'
import { ScreenHeader, PrimaryButton } from './Shell'

export function TimetableScreen() {
  const { ttDay, timetableData, back, set, addTimetableEntry, deleteTimetableEntry, updateTimetableEntry, subjects, students, role } = useDashboard()
  const isAdmin = role === 'admin'
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string[] | null>(null) // the original period being edited
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [room, setRoom] = useState('')
  const classes = [...new Set([...students.map(s => s.klass), ...(klass ? [klass] : [])])].filter(Boolean)
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

  const resetForm = () => { setStartTime('09:00'); setEndTime('10:00'); setSubject(''); setKlass(''); setRoom(''); setShowForm(false); setEditing(null) }

  const handleAdd = () => {
    if (!selKlass) return
    const subj = subject || subjectNames[0] || 'Free period'
    if (editing) updateTimetableEntry(ttDay, editing, startTime, endTime, subj, selKlass, room)
    else addTimetableEntry(ttDay, startTime, endTime, subj, selKlass, room)
    resetForm()
  }

  const startEdit = (p: string[]) => {
    setStartTime(p[0]); setEndTime(p[1]); setSubject(p[2]); setKlass(p[3]); setRoom(p[4] ?? '')
    setEditing(p); setShowForm(true)
  }

  const periodStyle = (p: string[]) => {
    const free = p[2] === 'Free period'
    const special = p[2].includes('Test') || p[2].includes('meeting') || p[2].includes('Doubt')
    return {
      dot: free ? '#c2cad8' : special ? '#e0962f' : '#2a6fdb',
      bg: free ? '#f4f6fb' : '#fff',
      border: free ? '#e6eaf2' : special ? '#f0e2c4' : '#dbe6fa',
      titleColor: free ? '#9aa4b6' : '#1a2332',
      tag: free ? 'Free' : special ? 'Special' : 'Class',
      pillColor: free ? '#9aa4b6' : special ? '#e0962f' : '#2a6fdb',
      pillBg: free ? '#eef1f7' : special ? '#fcf3e3' : '#eaf1fc',
    }
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 td-wide">
      <ScreenHeader title="Timetable" onBack={back} right={isAdmin ? (
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">{showForm ? '×' : '+'}</span> {showForm ? 'Close' : 'Add'}
        </button>
      ) : undefined} />

      <div className="flex gap-2 overflow-x-auto mb-[18px] scrollbar-hide lg:hidden">
        {days.map(d => {
          const active = d.s === ttDay
          return (
            <button key={d.s} onClick={() => set({ ttDay: d.s })} className="shrink-0 min-w-[48px] border rounded-[14px] py-[9px] px-1.5 cursor-pointer text-center" style={{ background: active ? '#2a6fdb' : '#fff', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>
              <div className="text-[11px] font-bold" style={{ color: active ? '#fff' : '#3a4456' }}>{d.s}</div>
              <div className="text-sm font-extrabold mt-0.5" style={{ color: active ? '#fff' : '#3a4456' }}>{d.d}</div>
            </button>
          )
        })}
      </div>

      {isAdmin && showForm && (
        <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[18px] flex flex-col gap-3.5 lg:max-w-lg">
          <div className="text-sm font-extrabold text-td-dark">{editing ? 'Edit' : 'Add'} period — {dayNames[ttDay]}</div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
            <select value={subject || subjectNames[0] || 'Free period'} onChange={e => setSubject(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
              {subjectNames.map(s => <option key={s}>{s}</option>)}
              <option>Free period</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-[11px]">
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
              <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
                {classes.length ? classes.map(c => <option key={c}>{c}</option>) : <option value="">Add students first</option>}
              </select>
            </div>
            <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Room</label>
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 1" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" />
            </div>
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
            <div key={d.s} className={`rounded-2xl border p-2.5 min-h-[130px] ${d.s === ttDay ? 'border-td-primary bg-[#f7faff]' : 'border-td-border bg-white'}`}>
              <button onClick={() => set({ ttDay: d.s })} className="w-full text-center mb-2 cursor-pointer bg-transparent border-none">
                <div className="text-[11px] font-bold text-td-muted">{d.s}</div>
                <div className="text-[15px] font-extrabold text-td-dark">{d.d}</div>
              </button>
              {ps.length === 0 ? (
                <div className="text-center text-td-subtle text-[11px] py-3">—</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {ps.map((p, i) => {
                    const s = periodStyle(p)
                    return (
                      <div key={i} className="rounded-[11px] border p-2" style={{ background: s.bg, borderColor: s.border }}>
                        <div className="text-[10.5px] font-bold text-td-muted">{p[0]}–{p[1]}</div>
                        <div className="text-[12px] font-extrabold leading-tight mt-0.5" style={{ color: s.titleColor }}>{p[2]}</div>
                        <div className="text-[10.5px] text-td-muted mt-0.5">{p[3]}{p[4] ? ` · ${p[4]}` : ''}</div>
                        {isAdmin && (
                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => { set({ ttDay: d.s }); startEdit(p) }} className="flex-1 h-6 rounded-lg border border-[#dbe6fa] bg-[#eaf1fc] text-td-primary text-[11px] cursor-pointer">✎</button>
                            <button onClick={() => deleteTimetableEntry(d.s, p)} className="flex-1 h-6 rounded-lg border border-[#f4d8cf] bg-[#fdf3f0] text-td-red text-[12px] cursor-pointer">×</button>
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
        <div className="text-center text-td-muted text-sm py-8">No periods scheduled for {dayNames[ttDay]}</div>
      ) : (
        <div className="flex flex-col">
          {periods.map((p, i) => {
            const s = periodStyle(p)
            return (
              <div key={i} className="flex gap-[13px] items-stretch">
                <div className="shrink-0 w-[58px] text-right pt-1">
                  <div className="text-[12.5px] font-extrabold text-td-dark">{p[0]}</div>
                  <div className="text-[10.5px] text-td-subtle font-semibold">{p[1]}</div>
                </div>
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-[11px] h-[11px] rounded-full border-2 border-white" style={{ background: s.dot, boxShadow: `0 0 0 2px ${s.dot}` }} />
                  <div className="flex-1 w-0.5 bg-td-border" />
                </div>
                <div className="flex-1 pb-3.5">
                  <div className="rounded-2xl p-[13px] px-[15px] border" style={{ background: s.bg, borderColor: s.border }}>
                    <div className="flex justify-between items-center gap-2">
                      <div className="text-sm font-extrabold" style={{ color: s.titleColor }}>{p[2]}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10.5px] font-bold py-1 px-[9px] rounded-[20px]" style={{ color: s.pillColor, background: s.pillBg }}>{s.tag}</span>
                        {isAdmin && <button onClick={() => startEdit(p)} className="w-6 h-6 rounded-full border border-[#dbe6fa] bg-[#eaf1fc] text-td-primary flex items-center justify-center cursor-pointer text-[12px] leading-none">✎</button>}
                        {isAdmin && <button onClick={() => deleteTimetableEntry(ttDay, p)} className="w-6 h-6 rounded-full border border-[#f4d8cf] bg-[#fdf3f0] text-td-red flex items-center justify-center cursor-pointer text-[15px] leading-none">×</button>}
                      </div>
                    </div>
                    <div className="text-xs text-td-muted mt-1">{p[3]} · {p[4]}</div>
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
  const { attClass, att, students, back, set, toggleAtt, saveAttendance } = useDashboard()
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const roster = students.filter(s => s.klass === attClass).map(s => s.name)
  const absentCount = roster.reduce((a, _, i) => a + (att[i] === 'absent' ? 1 : 0), 0)
  const presentCount = roster.length - absentCount

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 td-wide">
      <div className="flex items-center gap-3.5 mb-[18px]">
        <button onClick={back} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-white flex items-center justify-center cursor-pointer shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a2332" strokeWidth="2.4" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <div className="text-xl font-extrabold text-td-dark">Mark Attendance</div>
          <div className="text-xs text-td-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No students added yet</div>
      ) : (
        <>
          <div className="flex gap-[9px] overflow-x-auto mb-4 scrollbar-hide">
            {classes.map(name => {
              const active = name === attClass
              return (
                <button key={name} onClick={() => set({ attClass: name, att: {} })} className="shrink-0 text-[13px] font-bold py-[9px] px-4 rounded-[20px] cursor-pointer border" style={{ background: active ? '#2a6fdb' : '#fff', color: active ? '#fff' : '#3a4456', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>{name}</button>
              )
            })}
          </div>

          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 bg-[#e7f5ee] rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-green">{presentCount}</div>
              <div className="text-[11px] text-[#5a8a72] font-semibold">Present</div>
            </div>
            <div className="flex-1 bg-[#fdecea] rounded-[14px] p-3 text-center">
              <div className="text-[22px] font-extrabold text-td-red">{absentCount}</div>
              <div className="text-[11px] text-[#a35545] font-semibold">Absent</div>
            </div>
          </div>

          <div className="text-xs text-td-subtle font-semibold mb-2.5">Tap a student to toggle present / absent</div>
          <div className="flex flex-col gap-[9px] mb-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            {roster.map((name, i) => {
              const absent = att[i] === 'absent'
              return (
                <button key={name} onClick={() => toggleAtt(i)} className="text-left border rounded-2xl p-3 px-3.5 flex items-center gap-[13px] cursor-pointer" style={{ background: absent ? '#fdecea' : '#fff', borderColor: absent ? '#f4c4bc' : '#e6eaf2' }}>
                  <div className="w-[38px] h-[38px] rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(name)}</div>
                  <div className="flex-1 text-[13.5px] font-bold text-td-dark">{name}</div>
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: absent ? '#e8553c' : '#2fa36b' }}>
                    <span className="w-[9px] h-[9px] rounded-full" style={{ background: absent ? '#e8553c' : '#2fa36b' }} />
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
  const { students, subjects, back, notify } = useDashboard()
  const [klass, setKlass] = useState('')
  const [subject, setSubject] = useState('')
  const [testName, setTestName] = useState('Unit Test')
  const [maxMarks, setMaxMarks] = useState('50')
  const [marks, setMarks] = useState<Record<number, string>>({})
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const selKlass = klass || classes[0] || ''
  const roster = students.filter(s => s.klass === selKlass).map(s => s.name)
  const subjectNames = subjects.map(s => s.name)
  const selSubject = subject || subjectNames[0] || ''

  const handlePublish = async () => {
    if (!testName.trim()) { notify('Enter test name'); return }
    if (!selKlass) { notify('Add students first'); return }
    if (!selSubject) { notify('Add a subject first (More → Subjects)'); return }
    const { supabase } = await import('../lib/supabase')
    const subjectId = useDashboard.getState().subjects.find(s => s.name === selSubject)?.dbId
    const { data: test, error } = await supabase.from('tests').insert({
      name: testName, subject_id: subjectId ?? null, class: selKlass,
      max_marks: Number(maxMarks) || 50, date: new Date().toISOString().split('T')[0],
    }).select().single()
    if (error || !test) { notify('Could not publish — try again'); return }
    const resultRows = Object.entries(marks).map(([idx, m]) => {
      const student = students.filter(s => s.klass === selKlass)[Number(idx)]
      if (!student?.dbId || !m) return null
      return { test_id: test.id, student_id: student.dbId, marks: Number(m) }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
    if (resultRows.length) {
      await supabase.from('results').insert(resultRows)
      useDashboard.getState().notifyClass(selKlass, 'New results published', `${testName} · ${selSubject} — check your marks in the app`, '📊')
    }
    notify('Results published & parents notified')
    setMarks({})
  }

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Enter Results" onBack={back} />

      <div className="grid grid-cols-2 gap-[11px] mb-[13px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
          <select value={selKlass} onChange={e => setKlass(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none">
            {classes.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
          <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={subjectNames.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
            {subjectNames.length ? subjectNames.map(s => <option key={s}>{s}</option>) : <option value="">Add subjects first</option>}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-[11px] mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Test name</label><input value={testName} onChange={e => setTestName(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Max</label><input value={maxMarks} onChange={e => setMaxMarks(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] text-td-dark outline-none focus:border-td-primary" /></div>
      </div>

      <div className="text-sm font-extrabold text-td-dark mb-3">Enter marks</div>
      {roster.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">No students in {selKlass || 'this class'}</div>
      ) : (
        <div className="flex flex-col gap-[9px] mb-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {roster.map((name, i) => (
            <div key={name} className="border border-td-border bg-white rounded-2xl p-[11px] px-3.5 flex items-center gap-[13px]">
              <div className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center text-white font-bold text-[13px]" style={{ background: av(i) }}>{initials(name)}</div>
              <div className="flex-1 text-[13.5px] font-bold text-td-dark">{name}</div>
              <input value={marks[i] ?? ''} onChange={e => setMarks(m => ({ ...m, [i]: e.target.value }))} placeholder="—" className="w-[62px] text-center border border-td-border rounded-[11px] py-[9px] px-1.5 text-sm font-bold text-td-dark outline-none focus:border-td-primary" />
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
  const { back, assignmentsList, saveAssignment, subjects, students } = useDashboard()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [instructions, setInstructions] = useState('')
  const subjectNames = subjects.map(s => s.name)
  const selSubject = subject || subjectNames[0] || ''
  const classes = [...new Set(students.map(s => s.klass))].filter(Boolean)
  const selKlass = klass || classes[0] || ''

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="New Assignment" onBack={back} />

      <div className="bg-white border border-td-border rounded-[20px] p-[17px] mb-[22px] flex flex-col gap-3.5">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Algebra worksheet 5" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
            <select value={selSubject} onChange={e => setSubject(e.target.value)} disabled={subjectNames.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
              {subjectNames.length ? subjectNames.map(s => <option key={s}>{s}</option>) : <option value="">Add subjects first</option>}
            </select>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class</label>
            <select value={selKlass} onChange={e => setKlass(e.target.value)} disabled={classes.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none disabled:opacity-60">
              {classes.length ? classes.map(c => <option key={c}>{c}</option>) : <option value="">Add students first</option>}
            </select>
          </div>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Due date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Instructions</label><textarea rows={3} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Describe the task..." className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none resize-none focus:border-td-primary" /></div>
        <PrimaryButton onClick={() => { if (!selKlass) return; saveAssignment(title, selSubject, selKlass, dueDate, instructions); setTitle(''); setInstructions('') }}>Create &amp; notify class</PrimaryButton>
      </div>

      <div className="text-[15px] font-extrabold text-td-dark mb-3">Active assignments</div>
      {assignmentsList.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-4">No assignments yet</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {assignmentsList.map(a => (
            <div key={a.title + a.due} className="bg-white border border-td-border rounded-2xl p-3.5">
              <div className="flex justify-between items-start">
                <div className="text-[13.5px] font-bold text-td-dark">{a.title}</div>
                <span className="text-[11px] font-bold text-td-amber bg-[#fcf3e3] py-1 px-[9px] rounded-[20px] whitespace-nowrap">Due {a.due}</span>
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
  const { reminderType, back, set, saveReminder } = useDashboard()
  const [message, setMessage] = useState(REMINDER_TEMPLATES[reminderType] ?? '')
  const [filter, setFilter] = useState('all')
  const types = [
    { key: 'Test', label: 'Test', icon: '📝' },
    { key: 'Absence', label: 'Absence', icon: '🟡' },
    { key: 'Fee', label: 'Fee', icon: '💳' },
    { key: 'Homework', label: 'Homework', icon: '📚' },
  ]

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Send Reminder" onBack={back} />

      <label className="text-xs font-bold text-td-muted mb-2.5 block">Type</label>
      <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
        {types.map(r => {
          const active = r.key === reminderType
          return (
            <button key={r.key} onClick={() => { set({ reminderType: r.key }); setMessage(REMINDER_TEMPLATES[r.key] ?? '') }} className="border rounded-2xl p-3.5 cursor-pointer flex items-center gap-[11px]" style={{ background: active ? '#eaf1fc' : '#fff', borderColor: active ? '#2a6fdb' : '#e6eaf2' }}>
              <span className="text-xl">{r.icon}</span>
              <span className="text-[13.5px] font-bold" style={{ color: active ? '#2a6fdb' : '#3a4456' }}>{r.label}</span>
            </button>
          )
        })}
      </div>

      <label className="text-xs font-bold text-td-muted mb-[7px] block">Send to</label>
      <select value={filter} onChange={e => setFilter(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-white text-td-dark outline-none mb-4">
        <option value="all">All students</option>
        <option value="absentees">Absentees only</option>
        <option value="fees_due">Students with fees due</option>
      </select>

      <label className="text-xs font-bold text-td-muted mb-[7px] block">Message</label>
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none resize-none mb-[18px] focus:border-td-primary" />

      <PrimaryButton onClick={() => saveReminder(reminderType, message, 'all', filter)}>Send to students</PrimaryButton>
    </div>
  )
}
