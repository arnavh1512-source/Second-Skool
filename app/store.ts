import { create } from 'zustand'
import { supabase } from './lib/supabase'
import { sendPush, enablePush, pushSupported } from './lib/push'

// The full-dataset fetch lives in SupabaseProvider (it owns the row mappers).
// It registers itself here so store actions can re-pull fresh data after a
// mutation (e.g. marking attendance) instead of waiting for a focus/refresh.
let _refresh: (() => Promise<void>) | null = null
export const registerRefresh = (fn: () => Promise<void>) => { _refresh = fn }

const dbErr = (op: string, notify: (m: string) => void) =>
  ({ error }: { error: unknown }) => { if (error) notify(`Sync failed: ${op}`) }

export type Screen =
  | 'home' | 'timetable' | 'attendance' | 'results' | 'assign' | 'reminder'
  | 'students' | 'editStudent' | 'addStudent' | 'teachers' | 'addTeacher'
  | 'fees' | 'meetings' | 'rankings' | 'branches' | 'subjects' | 'notes' | 'more'
  | 'admin' | 'staffApprovals' | 'staffProfile' | 'reports' | 'register' | 'pending' | 'denied'
  | 'stuHome' | 'stuAttendance' | 'stuResults' | 'stuRanking' | 'stuTeachers'
  | 'stuTeacher' | 'stuFees' | 'stuNotif' | 'stuProfile' | 'stuEditProfile' | 'stuTimetable' | 'stuAssignments' | 'stuNotes'

export type Tab = 'home' | 'timetable' | 'students' | 'teachers' | 'more'
  | 'stuHome' | 'stuResults' | 'stuRanking' | 'stuTeachers' | 'stuProfile'
export type Role = 'admin' | 'teacher' | 'student' | null
export type StaffStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type FeeStatus = 'Paid' | 'Due' | 'Overdue'

export interface StaffMember { id: string; name: string; email: string; role: string; status: StaffStatus; headRequested: boolean }

export interface Teacher { name: string; subject: string; experience: number; qualification: string; rating?: string; about?: string; dbId?: string }
export interface Student { name: string; klass: string; attendance: number; feeStatus: FeeStatus; school: string; parent: string; id: string; address?: string; dbId?: string }

export interface ScheduleItem { time: string; ampm: string; subject: string; klass: string; room: string; status: string; statusColor: string; statusBg: string }
export interface MeetingItem { day: string; mon: string; title: string; time: string; kind: string; dbId?: string }
export interface AssignmentItem { title: string; due: string; klass: string; submitted: number; total: number; dbId?: string }
export interface BranchItem { name: string; address: string; students: number; staff: number; main: boolean; dbId?: string }
export interface StuResultItem { subject: string; test: string; date: string; marks: number; total: number }
export interface AttLogItem { day: string; date: string; status: string; icon: string; tint: string; color: string }
export interface StuAssignmentItem { title: string; subject: string; due: string; instructions: string }
export interface NoteItem { dbId?: string; title: string; subject: string; klass: string; body: string; fileUrl: string; linkUrl: string }
export interface StuNoteItem { title: string; subject: string; body: string; fileUrl: string; linkUrl: string; date: string }
export interface FeeHistoryItem { period: string; date: string; amount: string }
export interface NotifItem { icon: string; tint: string; title: string; detail: string; when: string; dbId?: string }
export interface SubjectItem { name: string; dbId: string }
export interface BranchReport { name: string; students: number; new_students: number; staff: number; att_pct: number; fees_collected: number; fees_pending: number }
export interface WeeklyReport { generated_at: string; branches: BranchReport[]; unassigned_students: number; tests_this_week: number }
export interface StudentReport { name: string; klass: string; parent: string; fee_status: string; att_present: number; att_total: number; tests: number; avg_pct: number }
export interface TeacherActivity { name: string; email: string; is_head: boolean; attendance_marks: number; tests_entered: number; assignments_created: number }

interface State {
  screen: Screen; tab: Tab; role: Role; origin: string | null
  attClass: string; att: Record<number, string>; rankSubject: string; ttDay: string
  toast: string; editIndex: number
  staffStatus: StaffStatus; headExists: boolean; staffList: StaffMember[]; weeklyReport: WeeklyReport | null; studentReports: StudentReport[] | null; teacherActivity: TeacherActivity[] | null
  googleEmail: string; myName: string; myPhone: string; centreName: string; centreLogo: string; joinCode: string; reminderType: string; plan: string
  newTeacher: { name: string; subject: string; qualification: string; experience: string; branch: string }
  newStudent: { name: string; school: string; klass: string; batch: string; branch: string; parent: string; address: string; fee: string; feeDue: string }
  stuTeacherIndex: number; stuRankSubject: string
  stuEdit: { name: string; parentNumber: string; address: string }
  supabaseUserId: string | null; authLoading: boolean; dataLoading: boolean

  teachers: Teacher[]; students: Student[]
  branchesList: BranchItem[]
  meetingsList: MeetingItem[]
  assignmentsList: AssignmentItem[]
  timetableData: Record<string, string[][]>
  schedule: ScheduleItem[]
  rankData: Record<string, [string, number][]>
  subjects: SubjectItem[]
  stuReminders: NotifItem[]
  stuNotifications: NotifItem[]
  stuAttendanceLog: AttLogItem[]
  stuFeeHistory: FeeHistoryItem[]
  stuResults: StuResultItem[]
  stuAssignments: StuAssignmentItem[]
  stuMonthly: { attPresent: number; attTotal: number; tests: number; avgPct: number } | null
  notesList: NoteItem[]
  stuNotes: StuNoteItem[]
  currentStudentDbId: string | null
  stuPendingFee: { amount: string; period: string; dueDate: string } | null
  searchQuery: string
  lastAdded: { code: string; name: string; parent: string } | null
}

interface Actions {
  go: (screen: Screen, tab?: Tab) => void
  goFrom: (screen: Screen, tab: Tab, origin: string) => void
  back: () => void
  notify: (msg: string) => void
  set: (partial: Partial<State>) => void

  toggleAtt: (i: number) => void
  setStudentField: (patch: Partial<Student>) => void
  setNewTeacher: (patch: Partial<State['newTeacher']>) => void
  setNewStudent: (patch: Partial<State['newStudent']>) => void
  deleteStudent: () => void
  saveTeacher: () => void
  addStudent: () => void
  saveAttendance: (studentNames: string[]) => void
  saveMeeting: (title: string, type: string, date: string, time: string) => void
  saveAssignment: (title: string, subject: string, klass: string, dueDate: string, instructions: string) => void
  saveReminder: (type: string, message: string, targetClass: string, filter?: string) => void
  notifyClass: (klass: string, title: string, detail: string, icon: string) => void
  saveStudentProfile: () => void
  addFee: (studentDbId: string, amount: number, period: string, dueDate: string) => void
  toggleFeeStatus: (idx: number) => void
  addTimetableEntry: (day: string, startTime: string, endTime: string, subject: string, klass: string, room: string) => void
  deleteTimetableEntry: (day: string, p: string[]) => void
  updateTimetableEntry: (day: string, oldP: string[], startTime: string, endTime: string, subject: string, klass: string, room: string) => void
  addBranch: (name: string, address: string, isMain: boolean) => void
  deleteBranch: (dbId: string) => void
  addSubject: (name: string) => void
  deleteSubject: (dbId: string) => void
  loadNotes: () => Promise<void>
  addNote: (n: { title: string; subject: string; klass: string; body: string; fileUrl: string; linkUrl: string }) => Promise<void>
  deleteNote: (dbId: string) => Promise<void>
  loadStudentNotes: () => Promise<void>
  loadStudentByCode: (code: string, navigate?: boolean) => Promise<boolean>
  createCentre: (name: string) => Promise<void>
  joinCentre: (code: string) => Promise<void>
  loadMyCentre: () => Promise<void>
  renameCentre: (name: string) => Promise<void>
  saveCentreLogo: (dataUrl: string) => Promise<void>
  loadStaff: () => Promise<void>
  loadWeeklyReport: (days?: number) => Promise<void>
  loadStudentReports: (days?: number) => Promise<void>
  loadTeacherActivity: (days?: number) => Promise<void>
  approveTeacher: (id: string) => Promise<void>
  rejectTeacher: (id: string) => Promise<void>
  grantHead: (id: string) => Promise<void>
  removeStaff: (id: string) => Promise<void>
  exitAdmin: () => void
  signOut: () => void
  loadTeachers: (t: Teacher[]) => void
  loadStudents: (s: Student[]) => void
  refreshData: () => Promise<void>
  setAuth: (userId: string | null, role: Role, email: string, staffStatus: StaffStatus, headExists: boolean, name?: string, phone?: string) => void
  saveStaffProfile: (name: string, phone: string) => Promise<void>
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useDashboard = create<State & Actions>((set, get) => ({
  screen: 'home', tab: 'home', role: null, origin: null,
  attClass: '', att: {}, rankSubject: '', ttDay: ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()],
  toast: '', editIndex: 0,
  staffStatus: 'none', headExists: false, staffList: [], weeklyReport: null, studentReports: null, teacherActivity: null,
  googleEmail: '', myName: '', myPhone: '', centreName: '', centreLogo: '', joinCode: '', reminderType: 'Test', plan: 'Monthly',
  newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' },
  newStudent: { name: '', school: '', klass: 'Class 10', batch: '10-B', branch: '', parent: '', address: '', fee: '', feeDue: '' },
  teachers: [], students: [],
  stuTeacherIndex: 0, stuRankSubject: '',
  stuEdit: { name: '', parentNumber: '', address: '' },
  supabaseUserId: null, authLoading: true, dataLoading: false,

  branchesList: [], meetingsList: [], assignmentsList: [],
  timetableData: {}, schedule: [], rankData: {}, subjects: [],
  stuReminders: [], stuNotifications: [], stuAttendanceLog: [],
  stuFeeHistory: [], stuResults: [], stuAssignments: [], stuMonthly: null,
  notesList: [], stuNotes: [],
  currentStudentDbId: null, stuPendingFee: null, searchQuery: '', lastAdded: null,

  go: (screen, tab) => set({ screen, tab: (tab ?? screen) as Tab, origin: null }),
  goFrom: (screen, tab, origin) => set({ screen, tab, origin }),
  back: () => { const { origin } = get(); set({ origin: null, screen: origin === 'admin' ? 'admin' : 'home' }) },

  notify: (msg) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: msg })
    toastTimer = setTimeout(() => set({ toast: '' }), 2000)
  },

  set: (partial) => set(partial),


  toggleAtt: (i) => set((s) => ({ att: { ...s.att, [i]: s.att[i] === 'absent' ? 'present' : 'absent' } })),

  setStudentField: (patch) => set((s) => {
    const arr = [...s.students]; arr[s.editIndex] = { ...arr[s.editIndex], ...patch }
    const updated = arr[s.editIndex]
    if (updated.dbId) {
      supabase.from('students').update({
        name: updated.name, class: updated.klass, school: updated.school,
        parent_contact: updated.parent, fee_status: updated.feeStatus,
      }).eq('id', updated.dbId).then(dbErr('update student', get().notify))
    }
    return { students: arr }
  }),

  setNewTeacher: (patch) => set((s) => ({ newTeacher: { ...s.newTeacher, ...patch } })),
  setNewStudent: (patch) => set((s) => ({ newStudent: { ...s.newStudent, ...patch } })),

  deleteStudent: () => {
    const { editIndex, students } = get()
    const student = students[editIndex]
    if (student?.dbId) {
      supabase.from('students').delete().eq('id', student.dbId).then(dbErr('delete student', get().notify))
    }
    set({ students: students.filter((_, i) => i !== editIndex), editIndex: 0 })
    get().notify('Student removed'); get().back()
  },

  saveTeacher: () => {
    const { newTeacher: nt, teachers, branchesList } = get()
    if (!nt.name.trim()) { get().notify('Enter a name first'); return }
    if (!nt.qualification.trim()) { get().notify('Enter qualification'); return }
    if (nt.experience && isNaN(Number(nt.experience))) { get().notify('Experience must be a number'); return }
    const t: Teacher = { name: nt.name, subject: nt.subject, qualification: nt.qualification || '—', experience: Number(nt.experience) || 0 }
    const branchId = nt.branch ? branchesList.find(b => b.name === nt.branch)?.dbId : null
    supabase.from('teachers').insert({ name: t.name, subject: t.subject, qualification: t.qualification, experience: t.experience, branch_id: branchId ?? null })
      .select().single().then(({ data }) => {
        if (data) set((s) => ({ teachers: s.teachers.map(x => x.name === t.name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ teachers: [t, ...teachers], newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' } })
    get().notify('Teacher added to staff'); get().back()
  },

  addStudent: () => {
    const { newStudent: ns, students, branchesList } = get()
    if (!ns.name.trim()) { get().notify('Enter student name'); return }
    if (!ns.parent.trim()) { get().notify('Enter parent contact'); return }
    if (ns.parent && !/^\+?\d[\d\s\-]{6,}$/.test(ns.parent)) { get().notify('Invalid phone number'); return }
    let code = genStudentCode()
    while (students.some(s => s.id === code)) code = genStudentCode()
    const student: Student = {
      name: ns.name, klass: `Class ${ns.batch}`, attendance: 0,
      feeStatus: 'Due', school: ns.school, parent: ns.parent, id: code,
    }
    const branchId = ns.branch ? branchesList.find(b => b.name.includes(ns.branch))?.dbId : null
    supabase.from('students').insert({
      name: ns.name, class: student.klass, school: ns.school,
      parent_contact: ns.parent, student_code: code, fee_status: 'Due',
      address: ns.address, branch_id: branchId ?? null,
    }).select().single().then(({ data, error }) => {
      if (error) { get().notify('Could not save student — check connection'); return }
      if (data) {
        set((s) => ({ students: s.students.map(x => x.id === code && !x.dbId ? { ...x, dbId: data.id } : x) }))
        // Optional enrolment fee — creates the first fee record so the student
        // immediately sees what's due (keeps status and fee records in sync).
        const amt = Number(ns.fee)
        if (amt > 0) {
          const period = new Date().toLocaleString('en', { month: 'short', year: 'numeric' })
          supabase.from('fees').insert({ student_id: data.id, amount: amt, period, due_date: ns.feeDue || new Date().toISOString().split('T')[0], status: 'Due' }).then(dbErr('add enrolment fee', get().notify))
        }
      }
    })
    set({ students: [student, ...students], newStudent: { name: '', school: '', klass: 'Class 10', batch: '10-B', branch: '', parent: '', address: '', fee: '', feeDue: '' }, lastAdded: { code, name: ns.name, parent: ns.parent } })
  },

  saveAttendance: (studentNames) => {
    const { att, students } = get()
    const records = studentNames.map((name, i) => {
      const student = students.find(s => s.name === name)
      if (!student?.dbId) return null
      return { student_id: student.dbId, date: new Date().toISOString().split('T')[0], status: att[i] === 'absent' ? 'Absent' : 'Present' }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
    if (records.length) {
      // Warn when overwriting: another teacher may have marked this class already.
      const today = new Date().toISOString().split('T')[0]
      const ids = records.map(r => r!.student_id)
      supabase.from('attendance').select('id').eq('date', today).in('student_id', ids).limit(1).then(({ data }) => {
        const already = !!data?.length
        supabase.from('attendance').upsert(records, { onConflict: 'student_id,date' }).then((res) => {
          dbErr('save attendance', get().notify)(res)
          if (already && !res.error) get().notify('Note: today’s attendance was already marked — it has been updated')
          // Re-pull so the Students list shows the new attendance % right away,
          // instead of staying stale until the next focus/manual refresh.
          if (!res.error) get().refreshData()
        })
      })
    }
    // Tell only the absent students (their parents watch these devices).
    const absent = studentNames
      .map((name, i) => (att[i] === 'absent' ? students.find(s => s.name === name) : null))
      .filter((s): s is NonNullable<typeof s> => !!s?.dbId)
    if (absent.length) {
      const rows = absent.map(s => ({ student_id: s.dbId, title: 'Marked absent today', detail: `${s.name} was marked absent. Please contact the centre if this is a mistake.`, icon: '🟡' }))
      supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
      const codes = absent.map(s => s.id).filter(Boolean)
      if (codes.length) sendPush({ studentCodes: codes, title: 'Marked absent today', body: 'Your ward was marked absent at the centre today.' }).then(() => {})
    }
    get().notify(`Attendance saved · ${studentNames.length - Object.values(att).filter(v => v === 'absent').length} present`)
  },

  saveMeeting: (title, type, date, time) => {
    if (!title.trim()) { get().notify('Enter a title'); return }
    const { meetingsList } = get()
    const d = new Date(date || Date.now())
    const item: MeetingItem = {
      title, time, kind: type,
      day: String(d.getDate()).padStart(2, '0'),
      mon: d.toLocaleString('en', { month: 'short' }),
    }
    supabase.from('meetings').insert({ title, meeting_type: type, date: d.toISOString().split('T')[0], time }).then(dbErr('save meeting', get().notify))
    set({ meetingsList: [item, ...meetingsList] })
    get().notify('Meeting scheduled · invites sent')
  },

  saveAssignment: (title, subject, klass, dueDate, instructions) => {
    if (!title.trim()) { get().notify('Enter a title'); return }
    const { assignmentsList, subjects } = get()
    const d = new Date(dueDate || Date.now())
    const item: AssignmentItem = {
      title, klass, due: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
      submitted: 0, total: get().students.filter(s => s.klass.includes(klass.replace('Class ', ''))).length,
    }
    const subjectId = subjects.find(s => s.name === subject)?.dbId
    supabase.from('assignments').insert({
      title, class: klass, due_date: d.toISOString().split('T')[0],
      instructions: instructions || null, subject_id: subjectId ?? null,
    }).then(dbErr('save assignment', get().notify))
    set({ assignmentsList: [item, ...assignmentsList] })
    get().notifyClass(klass, 'New homework', `${title} — due ${item.due}`, '📚')
    get().notify('Assignment created · class notified')
  },

  saveReminder: (type, message, targetClass, filter) => {
    const { students } = get()
    const icons: Record<string, string> = { Test: '📝', Absence: '🟡', Fee: '💳', Homework: '📚' }
    const icon = icons[type] ?? '🔔'

    let targets = students.filter(s => s.dbId)
    if (filter === 'absentees') targets = targets.filter(s => s.attendance === 0)
    else if (filter === 'fees_due') targets = targets.filter(s => s.feeStatus !== 'Paid')
    else if (targetClass && targetClass !== 'all') targets = targets.filter(s => s.klass === targetClass)

    supabase.from('reminders').insert({ type, message, target_class: targetClass }).then(dbErr('send reminder', get().notify))
    if (targets.length) {
      const rows = targets.map(s => ({ student_id: s.dbId, title: `${type} Reminder`, detail: message, icon }))
      supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
      // Push to students who enabled notifications; report the result so it's
      // clear whether any device actually got a lock-screen alert.
      const codes = targets.map(s => s.id).filter(Boolean)
      if (codes.length) sendPush({ studentCodes: codes, title: `${type} reminder`, body: message })
        .then(r => {
          // The in-app reminder already lands for every student (notifications
          // insert above). Only surface the push leg when it adds signal: a real
          // error, or a positive device count. Stay silent on 0 so it never
          // reads as a failure when no student has enabled phone push yet.
          if (r.error) get().notify(`Push failed: ${r.error}`)
          else if (r.sent) get().notify(`Also pushed to ${r.sent} device(s)`)
        })
    }

    const now = new Date().toISOString()
    const newNotifs = targets.map(() => ({
      icon, tint: '#eaf1fc', title: `${type} Reminder`, detail: message, when: 'Just now', dbId: now,
    }))
    set((s) => ({ stuNotifications: [...newNotifs, ...s.stuNotifications] }))
    get().notify(`${type} reminder sent to ${targets.length} students`)
  },

  // Auto-notify students when staff adds content (homework, results, notes,
  // absence). Inserts in-app notification rows and fires a best-effort push.
  notifyClass: (klass, title, detail, icon) => {
    const { students } = get()
    let targets = students.filter(s => s.dbId)
    if (klass && klass !== 'all') targets = targets.filter(s => s.klass === klass)
    if (!targets.length) return
    const rows = targets.map(s => ({ student_id: s.dbId, title, detail, icon }))
    supabase.from('notifications').insert(rows).then(dbErr('send notifications', get().notify))
    const codes = targets.map(s => s.id).filter(Boolean)
    if (codes.length) sendPush({ studentCodes: codes, title, body: detail })
      .then(r => { if (!r.error) get().notify(`Notified ${targets.length} student(s) · push to ${r.sent} device(s)`) })
  },

  saveStudentProfile: async () => {
    const { stuEdit, currentStudentDbId, students } = get()
    const idx = students.findIndex(s => s.dbId === currentStudentDbId)
    if (idx < 0) { get().notify('No student profile linked'); return }
    const updated = { ...students[idx] }
    if (stuEdit.name.trim()) updated.name = stuEdit.name.trim()
    if (stuEdit.parentNumber.trim()) updated.parent = stuEdit.parentNumber.trim()
    if (stuEdit.address.trim()) updated.address = stuEdit.address.trim()
    const { error } = await supabase.rpc('update_student_self', {
      p_code: updated.id, p_name: updated.name, p_parent: updated.parent, p_address: updated.address ?? '',
    })
    if (error) { get().notify('Could not update — try again'); return }
    const arr = [...students]; arr[idx] = updated
    set({ students: arr, stuEdit: { name: '', parentNumber: '', address: '' } })
    get().notify('Profile updated'); get().go('stuProfile', 'stuProfile')
  },

  addFee: (studentDbId, amount, period, dueDate) => {
    const { students } = get()
    if (studentDbId) {
      supabase.from('fees').insert({ student_id: studentDbId, amount, period, due_date: dueDate, status: 'Due' }).then(dbErr('add fee', get().notify))
      supabase.from('students').update({ fee_status: 'Due' }).eq('id', studentDbId).then(dbErr('update fee status', get().notify))
    }
    const idx = students.findIndex(s => s.dbId === studentDbId)
    if (idx >= 0) {
      const arr = [...students]; arr[idx] = { ...arr[idx], feeStatus: 'Due' }
      set({ students: arr })
    }
    get().notify('Fee record added')
  },

  toggleFeeStatus: (idx) => {
    const { students } = get()
    const student = students[idx]
    if (!student) return
    const newStatus: FeeStatus = student.feeStatus === 'Paid' ? 'Due' : 'Paid'
    const arr = [...students]; arr[idx] = { ...arr[idx], feeStatus: newStatus }
    set({ students: arr })
    if (student.dbId) {
      supabase.from('students').update({ fee_status: newStatus }).eq('id', student.dbId).then(dbErr('toggle fee', get().notify))
      if (newStatus === 'Paid') {
        supabase.from('fees').update({ status: 'Paid', paid_date: new Date().toISOString().split('T')[0] })
          .eq('student_id', student.dbId).eq('status', 'Due').then(dbErr('mark fees paid', get().notify))
      } else {
        // Reopen ONLY fees marked paid today (undo for a mis-tap). Historical
        // paid months must never flip back — that would corrupt fee history
        // and the fees-collected report.
        const today = new Date().toISOString().split('T')[0]
        supabase.from('fees').update({ status: 'Due', paid_date: null })
          .eq('student_id', student.dbId).eq('status', 'Paid').eq('paid_date', today)
          .then(dbErr('reopen fees', get().notify))
      }
    }
    get().notify(`${student.name}: ${newStatus}`)
  },

  addTimetableEntry: (day, startTime, endTime, subject, klass, room) => {
    const { timetableData } = get()
    const updated = { ...timetableData }
    if (!updated[day]) updated[day] = []
    updated[day] = [...updated[day], [startTime, endTime, subject, klass, room]].sort((a, b) => a[0].localeCompare(b[0]))
    set({ timetableData: updated })
    supabase.from('timetable').insert({
      day, start_time: startTime, end_time: endTime,
      subject, class: klass, room: room || null,
    }).then(dbErr('add timetable', get().notify))
    get().notify(`Period added: ${subject} on ${day}`)
  },

  updateTimetableEntry: (day, oldP, startTime, endTime, subject, klass, room) => {
    const entry = [startTime, endTime, subject, klass, room]
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? [])
      .map(x => (x[0] === oldP[0] && x[1] === oldP[1] && x[2] === oldP[2] && x[3] === oldP[3]) ? entry : x)
      .sort((a, b) => a[0].localeCompare(b[0])) } }))
    supabase.from('timetable')
      .update({ start_time: startTime, end_time: endTime, subject, class: klass, room: room || null })
      .eq('day', day).eq('start_time', oldP[0]).eq('end_time', oldP[1]).eq('subject', oldP[2]).eq('class', oldP[3])
      .then(dbErr('update period', get().notify))
    get().notify(`Period updated: ${subject} on ${day}`)
  },

  deleteTimetableEntry: (day, p) => {
    set((s) => ({ timetableData: { ...s.timetableData, [day]: (s.timetableData[day] ?? []).filter(x => !(x[0] === p[0] && x[1] === p[1] && x[2] === p[2] && x[3] === p[3])) } }))
    supabase.from('timetable').delete()
      .eq('day', day).eq('start_time', p[0]).eq('end_time', p[1]).eq('subject', p[2]).eq('class', p[3])
      .then(dbErr('remove period', get().notify))
    get().notify('Period removed')
  },

  addBranch: (name, address, isMain) => {
    const { branchesList } = get()
    const branch: BranchItem = { name, address, main: isMain, students: 0, staff: 0 }
    supabase.from('branches').insert({ name, address, is_main: isMain }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ branchesList: s.branchesList.map(b => b.name === name && !b.dbId ? { ...b, dbId: data.id } : b) }))
      })
    set({ branchesList: [branch, ...branchesList] })
    get().notify('Branch added')
  },

  deleteBranch: (dbId) => {
    set((s) => ({ branchesList: s.branchesList.filter(b => b.dbId !== dbId) }))
    supabase.from('branches').delete().eq('id', dbId).then(dbErr('delete branch', get().notify))
    get().notify('Branch removed')
  },

  addSubject: (name) => {
    const { subjects: list } = get()
    if (list.some(s => s.name.toLowerCase() === name.toLowerCase())) { get().notify('Subject already exists'); return }
    const item: SubjectItem = { name, dbId: '' }
    supabase.from('subjects').insert({ name }).select().single()
      .then(({ data }) => {
        if (data) set((s) => ({ subjects: s.subjects.map(x => x.name === name && !x.dbId ? { ...x, dbId: data.id } : x) }))
      })
    set({ subjects: [...list, item] })
    get().notify(`Subject "${name}" added`)
  },

  deleteSubject: (dbId) => {
    const name = get().subjects.find(x => x.dbId === dbId)?.name
    // Remove everywhere: the subject row (DB cascades its tests/results;
    // assignments keep the record but drop the subject label) plus any
    // timetable periods that reference it by name.
    set((s) => ({
      subjects: s.subjects.filter(x => x.dbId !== dbId),
      timetableData: Object.fromEntries(Object.entries(s.timetableData).map(([d, rows]) => [d, rows.filter(p => p[2] !== name)])),
      schedule: s.schedule.filter(c => c.subject !== name),
    }))
    supabase.from('subjects').delete().eq('id', dbId).then(dbErr('delete subject', get().notify))
    if (name) supabase.from('timetable').delete().eq('subject', name).then(dbErr('remove periods', get().notify))
    get().notify('Subject removed everywhere')
  },

  loadNotes: async () => {
    const { data, error } = await supabase.from('notes')
      .select('id, title, subject, class, body, file_url, link_url')
      .order('created_at', { ascending: false })
    if (error) { get().notify('Could not load notes'); return }
    set({ notesList: (data ?? []).map((n: { id: string; title: string; subject: string | null; class: string; body: string | null; file_url: string | null; link_url: string | null }) => ({
      dbId: n.id, title: n.title, subject: n.subject ?? '', klass: n.class,
      body: n.body ?? '', fileUrl: n.file_url ?? '', linkUrl: n.link_url ?? '',
    })) })
  },

  addNote: async (n) => {
    if (!n.title.trim()) { get().notify('Enter a title'); return }
    if (!n.body.trim() && !n.fileUrl && !n.linkUrl) { get().notify('Add a note, file, or link'); return }
    const { data, error } = await supabase.from('notes').insert({
      title: n.title.trim(), subject: n.subject || null, class: n.klass,
      body: n.body.trim() || null, file_url: n.fileUrl || null, link_url: n.linkUrl.trim() || null,
    }).select('id').single()
    if (error) { get().notify('Could not save note'); return }
    set((s) => ({ notesList: [{ dbId: data.id, ...n }, ...s.notesList] }))
    get().notifyClass(n.klass, 'New study material', n.subject ? `${n.title.trim()} · ${n.subject}` : n.title.trim(), '📄')
    get().notify('Note shared with the class')
  },

  deleteNote: async (dbId) => {
    set((s) => ({ notesList: s.notesList.filter(x => x.dbId !== dbId) }))
    await supabase.from('notes').delete().eq('id', dbId).then(dbErr('delete note', get().notify))
    get().notify('Note removed')
  },

  loadStudentNotes: async () => {
    const code = typeof window !== 'undefined' ? localStorage.getItem('student_code') : null
    if (!code) return
    const { data, error } = await supabase.rpc('get_student_notes', { p_code: code })
    if (error) { get().notify('Could not load study material'); return }
    set({ stuNotes: (data ?? []).map((n: { title: string | null; subject: string | null; body: string | null; fileUrl: string | null; linkUrl: string | null; date: string | null }) => ({
      title: n.title ?? '', subject: n.subject ?? '', body: n.body ?? '',
      fileUrl: n.fileUrl ?? '', linkUrl: n.linkUrl ?? '', date: n.date ?? '',
    })) })
  },

  loadStudentByCode: async (code, navigate = true) => {
    const trimmed = code.trim()
    if (trimmed.length < 4) { if (navigate) get().notify('Enter your code'); return false }
    const { data, error } = await supabase.rpc('get_student_snapshot', { p_code: trimmed })
    if (error || !data) {
      // Surface the rate-limit message; otherwise a generic invalid-code note.
      const msg = error?.message?.includes('Too many') ? error.message : 'Invalid code — check with your teacher'
      if (navigate) get().notify(msg)
      return false
    }
    if (typeof window !== 'undefined') localStorage.setItem('student_code', trimmed)
    const patch: Partial<State> = mapSnapshot(data)
    // Only navigate on the initial load; a background (focus) refresh just
    // updates the data and must not yank the student off their current screen.
    if (navigate) {
      Object.assign(patch, {
        role: 'student', staffStatus: 'none', screen: 'stuHome', tab: 'stuHome' as Tab,
        authLoading: false, stuRankSubject: Object.keys(patch.rankData ?? {})[0] ?? '',
      })
      // Auto-prompt for push on login so students don't have to hunt for a
      // button. enablePush is idempotent and stays silent once permission is
      // decided (granted → re-subscribes, denied → no dialog); skip when denied
      // and swallow failures so a blocked prompt never disrupts login.
      if (pushSupported() && Notification.permission !== 'denied') enablePush('student', trimmed).catch(() => {})
    }
    set(patch)
    return true
  },

  createCentre: async (name) => {
    const { error } = await supabase.rpc('create_centre', { p_name: name })
    if (error) { get().notify(error.message || 'Could not create centre'); return }
    get().notify('Centre created — welcome!')
    if (typeof window !== 'undefined') window.location.reload()
  },

  joinCentre: async (code) => {
    const { error } = await supabase.rpc('join_centre', { p_code: code })
    if (error) { get().notify(error.message || 'Invalid centre code'); return }
    sendPush({ notifyHead: true, title: 'New access request', body: `${get().myName || 'A teacher'} is requesting access to your centre.` })
    set({ role: 'teacher', staffStatus: 'pending', screen: 'pending', tab: 'home' })
  },

  loadMyCentre: async () => {
    const { data } = await supabase.rpc('my_centre')
    if (data) {
      const d = data as { name?: string; join_code?: string; logo_url?: string }
      set({ centreName: d.name ?? '', joinCode: d.join_code ?? '', centreLogo: d.logo_url ?? '' })
    }
  },

  // White-label: the head sets a centre logo that students see after they log
  // in with a centre code. Stored as a small data-URL in centres.logo_url;
  // RLS centres_write lets only the owner update their centre row. Pass '' to
  // clear it and fall back to the default branding.
  saveCentreLogo: async (dataUrl) => {
    const id = get().supabaseUserId
    if (!id) return
    const { error } = await supabase.from('centres').update({ logo_url: dataUrl || null }).eq('owner_id', id)
    if (error) { get().notify('Could not save logo — only the centre owner can'); return }
    set({ centreLogo: dataUrl })
    get().notify(dataUrl ? 'Centre logo updated' : 'Centre logo removed')
  },

  renameCentre: async (name) => {
    const trimmed = name.trim()
    if (trimmed.length < 2) { get().notify('Enter a centre name'); return }
    const id = get().supabaseUserId
    if (!id) return
    // RLS centres_write allows only the owner to update their centre row.
    const { error } = await supabase.from('centres').update({ name: trimmed }).eq('owner_id', id)
    if (error) { get().notify('Could not rename — only the centre owner can'); return }
    set({ centreName: trimmed })
    get().notify('Centre renamed')
  },

  loadStaff: async () => {
    // Read profiles directly — RLS already lets an authenticated head view all
    // profiles, and this avoids any dependency on the list_staff RPC being
    // present/healthy in the live DB.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, staff_status, head_requested')
      .neq('staff_status', 'none')
      .order('created_at', { ascending: false })
    if (error) { console.error('loadStaff failed:', error.message); get().notify(`Could not load staff: ${error.message}`); return }
    const list: StaffMember[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, name: r.full_name as string, email: (r.email as string) ?? '',
      role: r.role as string, status: r.staff_status as StaffStatus, headRequested: !!r.head_requested,
    }))
    set({ staffList: list })
  },

  loadWeeklyReport: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_branch_report', { p_days: days })
    if (error) { console.error('weekly report failed:', error.message); get().notify(`Could not load report: ${error.message}`); return }
    set({ weeklyReport: data as WeeklyReport })
  },

  loadStudentReports: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_student_reports', { p_days: days })
    if (error) { console.error('student reports failed:', error.message); get().notify(`Could not load reports: ${error.message}`); return }
    set({ studentReports: (data ?? []) as StudentReport[] })
  },

  loadTeacherActivity: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_teacher_activity', { p_days: days })
    if (error) { console.error('teacher activity failed:', error.message); get().notify(`Could not load activity: ${error.message}`); return }
    set({ teacherActivity: (data ?? []) as TeacherActivity[] })
  },

  approveTeacher: async (id) => {
    const { error } = await supabase.rpc('approve_teacher', { p_id: id })
    if (error) { get().notify('Could not approve'); return }
    get().notify('Teacher approved'); await get().loadStaff()
  },

  rejectTeacher: async (id) => {
    const { error } = await supabase.rpc('reject_teacher', { p_id: id })
    if (error) { get().notify('Could not reject'); return }
    get().notify('Teacher rejected'); await get().loadStaff()
  },

  grantHead: async (id) => {
    const { error } = await supabase.rpc('grant_head', { p_id: id })
    if (error) { get().notify('Could not grant head access'); return }
    get().notify('Head access granted'); await get().loadStaff()
  },

  removeStaff: async (id) => {
    const { error } = await supabase.rpc('remove_staff', { p_id: id })
    if (error) { get().notify('Could not remove'); return }
    get().notify('Access removed'); await get().loadStaff()
  },

  exitAdmin: () => set({ screen: 'home', tab: 'home', origin: null }),

  signOut: () => {
    supabase.auth.signOut()
    if (typeof window !== 'undefined') localStorage.removeItem('student_code')
    set({
      role: null, googleEmail: '', screen: 'home' as Screen, tab: 'home' as Tab,
      supabaseUserId: null, staffStatus: 'none', headExists: false, staffList: [],
      teachers: [], students: [], branchesList: [], meetingsList: [], assignmentsList: [],
      timetableData: {}, schedule: [], rankData: {}, subjects: [],
      stuReminders: [], stuNotifications: [], stuAttendanceLog: [], stuFeeHistory: [], stuResults: [], stuAssignments: [], stuMonthly: null, stuNotes: [],
      currentStudentDbId: null, stuPendingFee: null,
    })
    get().notify('Signed out')
  },

  loadTeachers: (t) => set({ teachers: t }),
  loadStudents: (s) => set((prev) => ({ students: s, attClass: prev.attClass || (s.length ? s[0].klass : '') })),
  refreshData: async () => { await _refresh?.() },
  setAuth: (userId, role, email, staffStatus, headExists, name = '', phone = '') => {
    // Decide the landing screen for a signed-in Google (staff) user.
    const approved = staffStatus === 'approved'
    let screen: Screen
    if ((role === 'admin' || role === 'teacher') && approved) screen = 'home'
    else if (role === 'teacher' && staffStatus === 'pending') screen = 'pending'
    else if (staffStatus === 'rejected') screen = 'denied'
    else screen = 'register' // unregistered staff (role 'student'/none)
    set({
      supabaseUserId: userId, role, staffStatus, headExists, authLoading: false,
      googleEmail: email ?? '', myName: name ?? '', myPhone: phone ?? '', screen, tab: 'home',
    })
  },

  saveStaffProfile: async (name, phone) => {
    const id = get().supabaseUserId
    if (!id) return
    const trimmed = name.trim()
    if (!trimmed) { get().notify('Name is required'); return }
    if (phone.trim() && !/^\+?\d[\d\s-]{6,}$/.test(phone.trim())) { get().notify('Invalid phone number'); return }
    const { error } = await supabase.from('profiles').update({ full_name: trimmed, phone: phone.trim() || null }).eq('id', id)
    if (error) { get().notify('Could not save profile — check your connection'); return }
    set({ myName: trimmed, myPhone: phone.trim() })
    get().notify('Profile updated')
  },
}))

// --- Helpers ---
// Strong, human-readable student codes. Alphabet excludes confusable
// characters (0/O, 1/I/L) so codes are easy to read aloud and hard to guess.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function genStudentCode(): string {
  // Rejection sampling: only accept bytes below the largest multiple of the
  // alphabet size, so every character is uniformly likely (no modulo bias).
  const max = 256 - (256 % CODE_ALPHABET.length)
  let s = ''
  while (s.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    for (const b of bytes) {
      if (b < max && s.length < 8) s += CODE_ALPHABET[b % CODE_ALPHABET.length]
    }
  }
  return `TUT-${s}`
}

export const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
export const COLORS = ['#2a6fdb','#7c5cdb','#2fa36b','#e0962f','#d94f8a','#3aa0c4','#c4683a','#5a93ef']
export const GRADIENTS = ['linear-gradient(135deg,#2a6fdb,#5a93ef)','linear-gradient(135deg,#7c5cdb,#a487ef)','linear-gradient(135deg,#2fa36b,#56c48d)','linear-gradient(135deg,#e0962f,#efb45a)','linear-gradient(135deg,#d94f8a,#ec7cae)','linear-gradient(135deg,#3aa0c4,#62bcd8)']
export const av = (i: number) => COLORS[i % COLORS.length]
export const feeColor = (s: string) => s === 'Paid' ? { c: '#2fa36b', b: '#e7f5ee' } : s === 'Due' ? { c: '#e0962f', b: '#fcf3e3' } : { c: '#e8553c', b: '#fdecea' }
export const stuGrade = (pct: number) => pct >= 90 ? { g: 'A+', c: '#2fa36b', t: '#e7f5ee' } : pct >= 80 ? { g: 'A', c: '#2a6fdb', t: '#eaf1fc' } : pct >= 70 ? { g: 'B', c: '#e0962f', t: '#fcf3e3' } : { g: 'C', c: '#e8553c', t: '#fdecea' }

export const PLAN_META: Record<string, { name: string; price: string; permonth: string; save: string; renews: string }> = {
  Monthly: { name: 'Monthly', price: '₹799', permonth: 'Billed every month', save: '', renews: '24 Jul 2026' },
  'Half-yearly': { name: 'Half-yearly', price: '₹3,999', permonth: '₹666 / month', save: 'Save 17%', renews: '24 Dec 2026' },
  Yearly: { name: 'Yearly', price: '₹6,999', permonth: '₹583 / month', save: 'Save 27%', renews: '24 Jun 2027' },
}

export const PLAN_PERKS = ['Unlimited students & classes', 'Attendance, results & assignments', 'Reminders to parents & students', 'Multi-branch management']

export const REMINDER_TEMPLATES: Record<string, string> = {
  Test: 'Reminder: a unit test is scheduled for tomorrow. Please ensure your child revises the relevant chapters.',
  Absence: 'Your child was marked absent today. Kindly inform us of the reason or share any concerns.',
  Fee: 'Gentle reminder: the tuition fee is due. Please clear it at the earliest.',
  Homework: 'Reminder: Please submit the pending homework before the next class.',
}

// --- Student snapshot mapping (from get_student_snapshot RPC) ---
const STATUS_ICONS: Record<string, { icon: string; tint: string; color: string }> = {
  Present: { icon: '✅', tint: '#e7f5ee', color: '#2fa36b' },
  Absent: { icon: '❌', tint: '#fdecea', color: '#e8553c' },
  Leave: { icon: '📋', tint: '#fcf3e3', color: '#e0962f' },
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const rupee = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

// Shape of the get_student_snapshot RPC payload — keys mirror the SQL
// json_build_object; nullable columns are handled by the `??` fallbacks below.
type SnapRow = {
  [key: string]: unknown
  status: string; date: string; subject: string; test: string; marks: number; total: number
  period: string; paidDate: string; amount: number; dueDate: string
  icon: string; title: string; detail: string; createdAt: string
  name: string; experience: number; qualification: string; rating: number | null; about: string
  day: string; start: string; end: string; room: string; due: string; instructions: string
}
type Snapshot = {
  student?: { [key: string]: string | undefined }
  centre?: { name?: string; logo_url?: string }
  attendance?: SnapRow[]; results?: SnapRow[]; fees?: SnapRow[]; notifications?: SnapRow[]
  teachers?: SnapRow[]; timetable?: SnapRow[]; assignments?: SnapRow[]
  rankings?: Record<string, [string, number][]>
}

export function mapSnapshot(snap: Snapshot): Partial<State> {
  const s = snap.student ?? {}
  const attendance: SnapRow[] = snap.attendance ?? []
  const present = attendance.filter(a => a.status === 'Present').length
  const attPct = attendance.length ? Math.round((present / attendance.length) * 100) : 0

  const student: Student = {
    name: s.name ?? '', klass: s.klass ?? '', attendance: attPct,
    feeStatus: (s.feeStatus ?? 'Due') as FeeStatus, school: s.school ?? '',
    parent: s.parent ?? '', id: s.code ?? '', address: s.address ?? '', dbId: s.dbId,
  }

  const stuAttendanceLog: AttLogItem[] = attendance.slice(0, 15).map((a: SnapRow) => {
    const d = new Date(a.date)
    const si = STATUS_ICONS[a.status] ?? STATUS_ICONS.Present
    return {
      day: d.toLocaleString('en', { weekday: 'long' }),
      date: fmtDate(a.date), status: a.status, ...si,
    }
  })

  const stuResults: StuResultItem[] = (snap.results ?? []).map((r: SnapRow) => ({
    subject: r.subject ?? 'Unknown', test: r.test ?? 'Test', date: r.date ?? '',
    marks: r.marks ?? 0, total: r.total ?? 100,
  }))

  const fees: SnapRow[] = snap.fees ?? []
  const stuFeeHistory: FeeHistoryItem[] = fees.filter(f => f.status === 'Paid').map((f: SnapRow) => ({
    period: f.period ?? '', date: fmtDate(f.paidDate), amount: rupee(f.amount),
  }))
  const pending = fees.find(f => f.status !== 'Paid')
  const stuPendingFee = pending ? { amount: rupee(pending.amount), period: pending.period ?? '', dueDate: fmtDate(pending.dueDate) } : null

  const stuNotifications: NotifItem[] = (snap.notifications ?? []).map((n: SnapRow) => ({
    icon: n.icon ?? '📢', tint: '#eaf1fc', title: n.title ?? '', detail: n.detail ?? '',
    when: timeAgo(n.createdAt), dbId: n.createdAt,
  }))

  const teachers: Teacher[] = (snap.teachers ?? []).map((t: SnapRow) => ({
    name: t.name, subject: t.subject, experience: t.experience ?? 0,
    qualification: t.qualification ?? '—',
    rating: t.rating != null ? String(t.rating) : undefined, about: t.about ?? undefined,
  }))

  const rankData = (snap.rankings ?? {}) as Record<string, [string, number][]>

  // Class timetable (head sets it per class; the student sees their class's).
  const timetableData: Record<string, string[][]> = {}
  for (const t of (snap.timetable ?? []) as SnapRow[]) {
    const day = t.day as string
    if (!timetableData[day]) timetableData[day] = []
    timetableData[day].push([t.start ?? '', t.end ?? '', t.subject ?? '', student.klass ?? '', t.room ?? ''])
  }

  const stuAssignments: StuAssignmentItem[] = (snap.assignments ?? []).map((a: SnapRow) => ({
    title: a.title ?? '', subject: a.subject ?? '', due: fmtDate(a.due), instructions: a.instructions ?? '',
  }))

  // Monthly summary (last 30 days) — computed from raw ISO dates before any
  // display formatting, so the student's home card is always current.
  const cutoff = Date.now() - 30 * 86400000
  const monthAtt = attendance.filter((a: SnapRow) => a.date && new Date(a.date).getTime() >= cutoff)
  const monthResults = (snap.results ?? []).filter((r: SnapRow) => r.date && new Date(r.date).getTime() >= cutoff)
  const mMarks = monthResults.reduce((acc: number, r: SnapRow) => acc + (r.marks ?? 0), 0)
  const mTotals = monthResults.reduce((acc: number, r: SnapRow) => acc + (r.total ?? 0), 0)
  const stuMonthly = {
    attPresent: monthAtt.filter((a: SnapRow) => a.status === 'Present').length,
    attTotal: monthAtt.length,
    tests: monthResults.length,
    avgPct: mTotals > 0 ? Math.round((mMarks / mTotals) * 100) : 0,
  }

  return {
    students: [student], currentStudentDbId: student.dbId ?? null,
    centreName: snap.centre?.name ?? '', centreLogo: snap.centre?.logo_url ?? '',
    stuAttendanceLog, stuResults, stuFeeHistory, stuPendingFee,
    stuNotifications, stuReminders: stuNotifications.slice(0, 3),
    teachers, rankData, timetableData, stuAssignments, stuMonthly,
  }
}
