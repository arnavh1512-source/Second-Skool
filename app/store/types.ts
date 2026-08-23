// Every shape the dashboard store deals in. Kept apart from the slices so a
// screen can import a type without pulling the whole store graph with it.
import type { IconName } from '../components/Icon'

export type Screen =
  | 'home' | 'timetable' | 'attendance' | 'results' | 'assign' | 'reminder'
  | 'students' | 'editStudent' | 'addStudent' | 'teachers' | 'addTeacher'
  | 'fees' | 'meetings' | 'rankings' | 'branches' | 'subjects' | 'batches' | 'notes' | 'more'
  | 'admin' | 'staffApprovals' | 'studentRequests' | 'staffProfile' | 'notifications' | 'reports' | 'profileSetup' | 'register' | 'pending' | 'denied'
  | 'stuSignup' | 'stuPending' | 'stuDenied'
  | 'stuHome' | 'stuAttendance' | 'stuResults' | 'stuRanking' | 'stuTeachers'
  | 'stuTeacher' | 'stuFees' | 'stuNotif' | 'stuProfile' | 'stuTimetable' | 'stuAssignments' | 'stuNotes'

export type Tab = 'home' | 'timetable' | 'students' | 'teachers' | 'more'
  | 'stuHome' | 'stuResults' | 'stuRanking' | 'stuTeachers' | 'stuProfile'
export type Role = 'admin' | 'teacher' | 'student' | null
export type StaffStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type FeeStatus = 'Paid' | 'Due' | 'Overdue'

export interface StaffMember { id: string; name: string; email: string; role: string; status: StaffStatus; headRequested: boolean; phone: string; subject: string; qualification: string }

export interface Teacher { name: string; subject: string; experience: number; qualification: string; rating?: string; about?: string; dbId?: string }
export interface Student { name: string; klass: string; batch?: string; branch?: string; attendance: number; feeStatus: FeeStatus; feeCollected?: number; feeDue?: number; school: string; parent: string; id: string; address?: string; dbId?: string; status?: string }
// A self-registered student awaiting the head's approval (roster is separate).
export interface PendingStudent { dbId: string; name: string; klass: string; school: string; parent: string; address: string; code: string; when: string }

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
export interface BatchItem { name: string; dbId: string }
export interface BranchReport { name: string; students: number; new_students: number; staff: number; att_pct: number; fees_collected: number; fees_pending: number }
export interface WeeklyReport { generated_at: string; branches: BranchReport[]; unassigned_students: number; tests_this_week: number }
export interface StudentReport { name: string; klass: string; parent: string; fee_status: string; att_present: number; att_total: number; tests: number; avg_pct: number }
export interface TeacherActivity { name: string; email: string; is_head: boolean; attendance_marks: number; tests_entered: number; assignments_created: number }

export interface StaffProfile { name: string; phone: string; subject: string; qualification: string }

export type ToastKind = 'info' | 'error'

export interface State {
  screen: Screen; tab: Tab; role: Role; origin: string | null
  attClass: string; att: Record<number, string>; rankSubject: string; ttDay: string
  toast: string; toastKind: ToastKind; editIndex: number
  // Mirrors navigator.onLine. Every write checks it before firing, so a teacher
  // on dead mobile data is told up front instead of after a failed round-trip.
  online: boolean
  // When the full dataset last came back from the server. Null until the first
  // successful pull — the screen has never held server data at that point.
  lastSyncedAt: number | null
  staffStatus: StaffStatus; headExists: boolean; staffList: StaffMember[]; weeklyReport: WeeklyReport | null; studentReports: StudentReport[] | null; teacherActivity: TeacherActivity[] | null
  googleEmail: string; myName: string; myPhone: string; mySubject: string; myQualification: string; profileDone: boolean
  centreName: string; centreLogo: string; joinCode: string; studentJoinCode: string; reminderType: string; plan: string
  newTeacher: { name: string; subject: string; qualification: string; experience: string; branch: string }
  newStudent: { name: string; school: string; klass: string; batch: string; branch: string; parent: string; address: string; fee: string; feeDue: string }
  stuSignup: { joinCode: string; name: string; parent: string; klass: string; school: string; address: string }
  stuPending: { name: string; code: string; centre: string } | null
  stuDenied: { name: string; centre: string } | null
  pendingStudents: PendingStudent[]
  stuTeacherIndex: number; stuRankSubject: string
  supabaseUserId: string | null; authLoading: boolean; dataLoading: boolean
  // null = not asked yet. Only the server knows who the operator is; this is
  // the answer to a probe, never a client-side comparison.
  devAllowed: boolean | null
  // Deliberately not a `screen`: the operator belongs to no centre, so they
  // never get past the approval gates that every screen sits behind. The
  // console is an overlay on top of the whole router instead.
  devConsoleOpen: boolean
  // The centre the operator is currently sitting inside as head, if any. The
  // server derives this from the profile row, so it survives a reload and can
  // never disagree with what the database actually allows.
  devSeat: { centreId: string; centreName: string } | null

  teachers: Teacher[]; students: Student[]
  branchesList: BranchItem[]
  meetingsList: MeetingItem[]
  assignmentsList: AssignmentItem[]
  timetableData: Record<string, string[][]>
  schedule: ScheduleItem[]
  rankData: Record<string, [string, number][]>
  subjects: SubjectItem[]
  batches: BatchItem[]
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

export interface Actions {
  go: (screen: Screen, tab?: Tab) => void
  goFrom: (screen: Screen, tab: Tab, origin: string) => void
  back: () => void
  notify: (msg: string, kind?: ToastKind) => void
  dismissToast: () => void
  setOnline: (v: boolean) => void
  set: (partial: Partial<State>) => void

  toggleAtt: (i: number) => void
  setStudentField: (patch: Partial<Student>) => void
  setNewTeacher: (patch: Partial<State['newTeacher']>) => void
  setNewStudent: (patch: Partial<State['newStudent']>) => void
  setStuSignup: (patch: Partial<State['stuSignup']>) => void
  studentSignup: () => Promise<void>
  approveStudent: (dbId: string, klass: string, branchId: string | null, fee: string, feeDue: string, batch?: string) => Promise<void>
  rejectStudent: (dbId: string) => Promise<void>
  deleteStudent: () => Promise<void>
  saveTeacher: () => Promise<void>
  addStudent: () => void
  saveAttendance: (roster: Student[]) => Promise<void>
  saveMeeting: (title: string, type: string, date: string, time: string) => Promise<boolean>
  saveAssignment: (title: string, subject: string, klass: string, dueDate: string, instructions: string) => Promise<boolean>
  deleteAssignment: (dbId: string) => Promise<void>
  saveReminder: (type: string, message: string, targetClass: string, filter?: string) => void
  notifyClass: (klass: string, title: string, detail: string, icon: IconName) => void
  addFee: (studentDbId: string, amount: number, period: string, dueDate: string) => Promise<boolean>
  toggleFeeStatus: (idx: number) => Promise<void>
  addTimetableEntry: (day: string, startTime: string, endTime: string, subject: string, klass: string, room: string) => Promise<boolean>
  deleteTimetableEntry: (day: string, p: string[]) => Promise<void>
  updateTimetableEntry: (day: string, oldP: string[], startTime: string, endTime: string, subject: string, klass: string, room: string) => Promise<boolean>
  addBranch: (name: string, address: string, isMain: boolean) => Promise<boolean>
  deleteBranch: (dbId: string) => Promise<void>
  addSubject: (name: string) => Promise<boolean>
  deleteSubject: (dbId: string) => Promise<void>
  addBatch: (name: string) => Promise<boolean>
  deleteBatch: (dbId: string) => Promise<void>
  loadNotes: () => Promise<void>
  addNote: (n: { title: string; subject: string; klass: string; body: string; fileUrl: string; linkUrl: string }) => Promise<void>
  deleteNote: (dbId: string) => Promise<void>
  loadStudentNotes: () => Promise<void>
  loadStudentByCode: (code: string, navigate?: boolean) => Promise<boolean>
  createCentre: (name: string) => Promise<void>
  joinCentre: (code: string) => Promise<void>
  loadMyCentre: () => Promise<void>
  regenerateStudentCode: () => Promise<void>
  renameCentre: (name: string) => Promise<void>
  saveCentreLogo: (dataUrl: string) => Promise<void>
  checkDevAccess: () => Promise<void>
  openDevConsole: () => void
  exitDevConsole: () => void
  devEnterCentre: (centreId: string) => Promise<void>
  devLeaveCentre: () => Promise<void>
  devDeleteCentre: (centreId: string, confirm: string) => Promise<void>
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
  setAuth: (userId: string | null, role: Role, email: string, staffStatus: StaffStatus, headExists: boolean, profile?: Partial<StaffProfile & { done: boolean }>) => void
  saveStaffProfile: (p: StaffProfile) => Promise<boolean>
  setMyPassword: (password: string) => Promise<boolean>
}

export type Store = State & Actions
