'use client'

import { useDashboard, initials, av, feeColor, GRADIENTS } from '../store'
import { ScreenHeader, PrimaryButton, BackButton, ChevronRight, EmptyState, WhatsAppIcon } from './Shell'
import { whatsappShareUrl, studentCodeMessage, copyText } from '../lib/share'
import { findStudent, indexOfStudent, studentKey } from '../lib/student-key'
import { opened } from '../lib/reach'
import { useBusy } from '../lib/use-busy'

// Full school range so any tuition centre can pick the right standard.
const STANDARDS = ['Class 12', 'Class 11', 'Class 10', 'Class 9', 'Class 8', 'Class 7', 'Class 6', 'Class 5', 'Class 4', 'Class 3', 'Class 2', 'Class 1']

export function StudentsScreen() {
  const { students, role, origin, back, go, goFrom, set, searchQuery } = useDashboard()
  const isAdmin = role === 'admin'
  // Arrived from the parent-reach card on Home, which asked "which families?".
  const missedOnly = origin === 'reach'
  const roster = missedOnly ? students.filter(s => !opened(s)) : students
  const filtered = searchQuery ? roster.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())) : roster

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 td-wide">
      <div className="flex items-center justify-between mt-1.5 mb-4">
        <div className="flex items-center gap-3">
          {origin === 'admin' && <BackButton onClick={back} />}
          <div className="text-2xl font-extrabold text-td-dark">Students</div>
        </div>
        {isAdmin && (
          <button onClick={() => origin === 'admin' ? goFrom('addStudent', 'students', 'admin') : go('addStudent', 'students')} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
            <span className="text-base leading-none">+</span> Add
          </button>
        )}
      </div>

      {missedOnly && (
        <div className="flex items-center justify-between gap-3 bg-td-tint-amber border border-td-edge-amber rounded-[14px] py-2.5 px-3.5 mb-3 lg:max-w-md">
          <span className="text-[12.5px] font-bold text-td-dark">Did not open the app this week</span>
          <button onClick={() => go('students', 'students')} className="border-none bg-transparent text-[12.5px] font-bold text-td-primary cursor-pointer shrink-0 p-0">Show all</button>
        </div>
      )}

      <div className="flex items-center gap-2.5 bg-td-card border border-td-border rounded-[14px] p-[11px] px-3.5 mb-[18px] lg:max-w-md">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-subtle)" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
        <input value={searchQuery} onChange={e => set({ searchQuery: e.target.value })} placeholder="Search students..." className="flex-1 text-[13.5px] text-td-dark outline-none bg-transparent" />
      </div>

      {filtered.length === 0 ? (
        missedOnly && !searchQuery ? (
          <EmptyState
            title="Every family opened the app"
            hint="All of them looked at least once this week. Nothing to chase."
          />
        ) : students.length === 0 ? (
          <EmptyState
            title="No students yet"
            hint="Add your students once, and attendance, marks, fees and rankings all work from that list."
            actionLabel={isAdmin ? 'Add your first student' : undefined}
            onAction={isAdmin ? () => (origin === 'admin' ? goFrom('addStudent', 'students', 'admin') : go('addStudent', 'students')) : undefined}
          />
        ) : (
          <EmptyState title="No matches" hint={`Nothing matches "${searchQuery}". Check the spelling, or clear the search.`} />
        )
      ) : (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s, i) => {
            // The avatar colour is the only thing that wants a position; which
            // student was tapped is remembered by key, so a roster reorder
            // while the edit screen is open cannot repoint it at someone else.
            const idx = students.indexOf(s)
            const f = feeColor(s.feeStatus)
            return (
              <div key={studentKey(s) || i} className="flex items-center gap-2">
                <button disabled={!isAdmin} onClick={() => set({ editId: studentKey(s), screen: 'editStudent', tab: 'students', ...(origin === 'admin' ? { origin: 'admin' } : {}) })} className={`flex-1 min-w-0 text-left bg-td-card border border-td-border rounded-[18px] p-3.5 flex items-center gap-[13px] ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}>
                  <div className="w-[46px] h-[46px] rounded-[14px] shrink-0 flex items-center justify-center text-white font-bold text-[15px]" style={{ background: av(idx) }}>{initials(s.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-td-dark">{s.name}</div>
                    <div className="text-xs text-td-muted mt-0.5">{s.klass} · {s.attendance}% attendance</div>
                  </div>
                  {isAdmin && <span className="text-[12px] font-bold py-[5px] px-[9px] rounded-[20px]" style={{ color: f.c, background: f.b }}>{s.feeStatus}</span>}
                  {isAdmin && <ChevronRight />}
                </button>
                {/* She opened this list because these families have not looked.
                    What they need is the code, which is the message the student's
                    own screen already sends — put it one tap from the name. */}
                {missedOnly && isAdmin && s.parent && (
                  <a href={whatsappShareUrl(s.parent, studentCodeMessage(s.name, s.id))} target="_blank" rel="noopener noreferrer" aria-label={`Send ${s.name}'s code on WhatsApp`} className="shrink-0 w-11 h-11 rounded-[14px] bg-[#25D366] text-white flex items-center justify-center">
                    <WhatsAppIcon />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function EditStudentScreen() {
  const { students, editId, origin, go, goFrom, setStudentField, saveStudentEdit, deleteStudent, notify } = useDashboard()
  const [saving, runSave] = useBusy()
  const st = findStudent(students, editId)
  // A background refresh can retire the student under this screen — deleted on
  // another device, or their approval revoked. Say so plainly rather than
  // rendering a blank form whose saves land nowhere.
  if (!st) return <div className="p-5 text-center text-td-muted">No student selected</div>
  const avatarIdx = indexOfStudent(students, editId)

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Edit Student" onBack={() => origin === 'admin' ? goFrom('students', 'students', 'admin') : go('students', 'students')} right={
        <button onClick={deleteStudent} className="border-none bg-td-tint-red text-td-red text-[12.5px] font-bold py-[9px] px-[13px] rounded-[13px] cursor-pointer">Remove</button>
      } />

      <div className="flex items-center gap-3.5 mb-3">
        <div className="w-16 h-16 rounded-[18px] shrink-0 flex items-center justify-center text-white font-extrabold text-[22px]" style={{ background: av(avatarIdx) }}>{initials(st.name)}</div>
        <div>
          <div className="text-[17px] font-extrabold text-td-dark">{st.name}</div>
          <div className="text-[12.5px] text-td-muted mt-0.5">{st.klass}</div>
        </div>
      </div>

      <button onClick={() => copyText(st.id, notify, 'Code copied!')} className="w-full border border-dashed border-td-primary bg-td-tint-blue rounded-[14px] p-3 mb-2.5 cursor-pointer flex items-center justify-between">
        <div>
          <div className="text-[12px] font-bold text-td-muted">STUDENT LINK CODE</div>
          <div className="text-[18px] font-extrabold text-td-primary tracking-wider">{st.id}</div>
        </div>
        <div className="text-[12px] font-bold text-td-primary flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </div>
      </button>
      <button onClick={() => window.open(whatsappShareUrl(st.parent, studentCodeMessage(st.name, st.id)), '_blank', 'noopener,noreferrer')} className="w-full border-none bg-[#25D366] text-white text-[13px] font-extrabold py-3 rounded-[14px] mb-[22px] cursor-pointer flex items-center justify-center gap-2">
        <WhatsAppIcon />
        Send code on WhatsApp
      </button>

      <div className="flex flex-col gap-3.5 mb-[18px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={st.name} onChange={e => setStudentField({ name: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Class / batch</label><input value={st.klass} onChange={e => setStudentField({ klass: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          {/* Attendance is computed from the attendance register, not stored on
              the student. It used to be an editable box that wrote to nothing:
              setStudentField never persisted it and the next refresh recomputed
              it, so a head who "corrected" a percentage watched it revert with
              no explanation. Read-only, and it says where the number comes from. */}
          <div>
            <label htmlFor="stu-attendance" className="text-xs font-bold text-td-muted mb-[7px] block">Attendance %</label>
            <output
              id="stu-attendance"
              className="w-full block border border-td-border bg-td-soft rounded-[14px] p-[13px] text-sm text-td-muted"
            >{st.attendance}% · from the register</output>
          </div>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">School</label><input value={st.school} onChange={e => setStudentField({ school: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Parent contact</label><input value={st.parent} onChange={e => setStudentField({ parent: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div>
          <label className="text-xs font-bold text-td-muted mb-[7px] block">Fee status</label>
          <div className="flex gap-[9px]">
            {(['Paid', 'Due', 'Overdue'] as const).map(label => {
              const active = label === st.feeStatus
              const fc = feeColor(label)
              return (
                <button key={label} onClick={() => setStudentField({ feeStatus: label })} className="flex-1 border text-[13px] font-bold p-[11px] rounded-[13px] cursor-pointer" style={{ background: active ? fc.b : '#fff', color: active ? fc.c : 'var(--color-td-subtle)', borderColor: active ? fc.c : 'var(--color-td-border)' }}>{label}</button>
              )
            })}
          </div>
        </div>
      </div>
      <PrimaryButton onClick={() => runSave(async () => {
        if (!await saveStudentEdit()) return
        if (origin === 'admin') goFrom('students', 'students', 'admin')
        else go('students', 'students')
      })}>{saving ? 'Saving…' : 'Save changes'}</PrimaryButton>
    </div>
  )
}

export function AddStudentScreen() {
  const { go, goFrom, origin, newStudent, setNewStudent, addStudent, branchesList, batches, lastAdded, set, notify } = useDashboard()
  const [adding, runAdd] = useBusy()
  const backToList = () => origin === 'admin' ? goFrom('students', 'students', 'admin') : go('students', 'students')

  if (lastAdded) {
    return (
      <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6 flex flex-col items-center justify-center min-h-[450px]">
        <div className="w-[72px] h-[72px] rounded-[22px] bg-td-tint-green flex items-center justify-center mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div className="text-[18px] font-extrabold text-td-dark mb-2">Student added!</div>
        <div className="text-[13px] text-td-muted text-center leading-relaxed mb-5 max-w-[280px]">Share this code with the parent so the student can log in.</div>
        <div className="w-full max-w-[280px] border-2 border-dashed border-td-primary bg-td-tint-blue rounded-[16px] p-4 text-center mb-5">
          <div className="text-[12px] font-bold text-td-muted mb-1">STUDENT LINK CODE</div>
          <div className="text-[24px] font-extrabold text-td-primary tracking-[0.15em]">{lastAdded.code}</div>
        </div>
        <button onClick={() => window.open(whatsappShareUrl(lastAdded.parent, studentCodeMessage(lastAdded.name, lastAdded.code)), '_blank', 'noopener,noreferrer')} className="w-full max-w-[280px] border-none bg-[#25D366] text-white text-[14px] font-extrabold py-[13px] rounded-[14px] cursor-pointer mb-3 flex items-center justify-center gap-2">
          <WhatsAppIcon />
          Send on WhatsApp
        </button>
        <button onClick={() => copyText(lastAdded.code, notify, 'Code copied!')} className="w-full max-w-[280px] border border-td-primary bg-td-card text-td-primary text-[14px] font-extrabold py-[13px] rounded-[14px] cursor-pointer mb-3 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy code
        </button>
        <button onClick={() => { set({ lastAdded: null }); backToList() }} className="w-full max-w-[280px] border-none bg-td-primary text-white text-[14px] font-extrabold py-[13px] rounded-[14px] cursor-pointer">Done</button>
      </div>
    )
  }

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Add Student" onBack={backToList} />

      <div className="flex flex-col gap-3.5 mb-[22px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={newStudent.name} onChange={e => setNewStudent({ name: e.target.value })} placeholder="Student name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">School</label><input value={newStudent.school} onChange={e => setNewStudent({ school: e.target.value })} placeholder="School" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Standard</label>
            <select value={newStudent.klass} onChange={e => setNewStudent({ klass: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-td-card text-td-dark outline-none">
              {STANDARDS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Batch</label>
            <select value={newStudent.batch} onChange={e => setNewStudent({ batch: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-td-card text-td-dark outline-none">
              <option value="">No batch</option>
              {batches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch</label>
            <select value={newStudent.branch} onChange={e => setNewStudent({ branch: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-td-card text-td-dark outline-none">
              {branchesList.length ? branchesList.map(b => <option key={b.name}>{b.name}</option>) : <option>No branches</option>}
            </select>
          </div>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Parent contact</label><input value={newStudent.parent} onChange={e => setNewStudent({ parent: e.target.value })} placeholder="+91" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Address</label><input value={newStudent.address} onChange={e => setNewStudent({ address: e.target.value })} placeholder="Address" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Monthly fee (&#8377;) <span className="text-td-subtle font-semibold">· optional</span></label><input type="number" value={newStudent.fee} onChange={e => setNewStudent({ fee: e.target.value })} placeholder="e.g. 2000" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Fee due date</label><input type="date" value={newStudent.feeDue} onChange={e => setNewStudent({ feeDue: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        </div>
        <div className="flex items-center gap-2.5 bg-td-tint-blue border border-td-edge-blue rounded-[14px] p-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="text-[12px] text-td-primary font-semibold">A secure login code is generated automatically and shown after you save.</span>
        </div>
      </div>
      <PrimaryButton onClick={() => runAdd(addStudent)}>{adding ? 'Saving…' : 'Save student'}</PrimaryButton>
    </div>
  )
}

export function StaffScreen() {
  const { teachers, origin, back, go, goFrom, set, searchQuery } = useDashboard()
  const filtered = searchQuery ? teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.subject.toLowerCase().includes(searchQuery.toLowerCase())) : teachers

  return (
    <div className="td-wide animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <div className="flex items-center justify-between mt-1.5 mb-[18px]">
        <div className="flex items-center gap-3">
          {origin === 'admin' && <BackButton onClick={back} />}
          <div className="text-2xl font-extrabold text-td-dark">Staff</div>
        </div>
        <button onClick={() => origin === 'admin' ? goFrom('addTeacher', 'teachers', 'admin') : go('addTeacher', 'teachers')} className="border-none bg-td-primary text-white text-[13px] font-bold py-2.5 px-[15px] rounded-[14px] cursor-pointer flex items-center gap-1.5">
          <span className="text-base leading-none">+</span> Add
        </button>
      </div>

      <div className="flex items-center gap-[11px] bg-td-card border border-td-border rounded-2xl p-[11px] px-[15px] mb-4 lg:max-w-md">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-subtle)" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input value={searchQuery} onChange={e => set({ searchQuery: e.target.value })} placeholder="Search staff..." className="flex-1 text-[13.5px] text-td-dark outline-none bg-transparent" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-td-muted text-sm py-8">{searchQuery ? 'No matches' : 'No teachers added yet'}</div>
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <div key={t.name + i} className="bg-td-card border border-td-border rounded-[18px] p-3.5 flex items-center gap-3.5">
              <div className="w-[52px] h-[52px] rounded-2xl shrink-0 flex items-center justify-center text-white font-extrabold text-[17px]" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>{initials(t.name)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-extrabold text-td-dark">{t.name}</div>
                <div className="text-[12.5px] text-td-primary font-bold mt-0.5">{t.subject}</div>
                <div className="text-[12px] text-td-muted mt-[3px]">{t.experience} yrs · {t.qualification}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AddTeacherScreen() {
  const { newTeacher: nt, subjects, branchesList, origin, go, goFrom, setNewTeacher, saveTeacher } = useDashboard()
  const subjectNames = subjects.map(s => s.name)
  const backToList = () => origin === 'admin' ? goFrom('teachers', 'teachers', 'admin') : go('teachers', 'teachers')

  return (
    <div className="animate-[pop_.35s_ease] px-5 pt-1.5 pb-6">
      <ScreenHeader title="Add Teacher" onBack={backToList} />

      <div className="flex flex-col gap-3.5 mb-[22px]">
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Full name</label><input value={nt.name} onChange={e => setNewTeacher({ name: e.target.value })} placeholder="Teacher name" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Subject</label>
          <select value={nt.subject || subjectNames[0] || ''} onChange={e => setNewTeacher({ subject: e.target.value })} disabled={subjectNames.length === 0} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-td-card text-td-dark outline-none disabled:opacity-60">
            {subjectNames.length ? subjectNames.map(s => <option key={s}>{s}</option>) : <option value="">Add subjects first</option>}
          </select>
        </div>
        <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Qualification</label><input value={nt.qualification} onChange={e => setNewTeacher({ qualification: e.target.value })} placeholder="e.g. M.Sc, B.Ed" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
        <div className="grid grid-cols-2 gap-[11px]">
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Years of exp.</label><input value={nt.experience} onChange={e => setNewTeacher({ experience: e.target.value })} placeholder="0" className="w-full border border-td-border rounded-[14px] p-[13px] text-sm text-td-dark outline-none focus:border-td-primary" /></div>
          <div><label className="text-xs font-bold text-td-muted mb-[7px] block">Branch</label>
            <select value={nt.branch} onChange={e => setNewTeacher({ branch: e.target.value })} className="w-full border border-td-border rounded-[14px] p-[13px] text-[13.5px] bg-td-card text-td-dark outline-none">
              <option value="">All branches</option>
              {branchesList.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <PrimaryButton onClick={saveTeacher}>Save teacher</PrimaryButton>
    </div>
  )
}
