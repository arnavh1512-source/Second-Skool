// Every shape the dashboard store deals in. Kept apart from the slices so a
// screen can import a type without pulling the whole store graph with it.
import type { IconName } from '../components/Icon'
import type { ReportDraft } from '../lib/support'
import type { Installment } from '../lib/fee-plan'
import type { QueuedBatch, AttConflict } from '../lib/att-queue'

export type Screen =
  | 'home' | 'timetable' | 'attendance' | 'results' | 'assign' | 'reminder'
  | 'students' | 'editStudent' | 'addStudent' | 'teachers' | 'addTeacher'
  | 'fees' | 'meetings' | 'rankings' | 'branches' | 'subjects' | 'batches' | 'notes' | 'more'
  | 'admin' | 'staffApprovals' | 'studentRequests' | 'staffProfile' | 'notifications' | 'reports' | 'profileSetup' | 'register' | 'pending' | 'denied'
  | 'stuSignup' | 'stuPending' | 'stuDenied'
  | 'stuHome' | 'stuAttendance' | 'stuResults' | 'stuRanking' | 'stuTeachers'
  | 'stuTeacher' | 'stuFees' | 'stuNotif' | 'stuProfile' | 'stuTimetable' | 'stuAssignments' | 'stuNotes'
  | 'support' | 'supportThread'

export type Tab = 'home' | 'timetable' | 'students' | 'teachers' | 'more'
  | 'stuHome' | 'stuResults' | 'stuRanking' | 'stuTeachers' | 'stuProfile'
export type Role = 'admin' | 'teacher' | 'student' | null
export type StaffStatus = 'none' | 'pending' | 'approved' | 'rejected'
export type FeeStatus = 'Paid' | 'Due' | 'Overdue'

export interface StaffMember { id: string; name: string; email: string; role: string; status: StaffStatus; phone: string; subject: string; qualification: string }

export interface Teacher { name: string; subject: string; experience: number; qualification: string; rating?: string; about?: string; dbId?: string }
export interface Student { name: string; klass: string; batch?: string; branch?: string; attendance: number; attendanceMarked?: number; feeStatus: FeeStatus; feeCollected?: number; feeDue?: number; school: string; parent: string; id: string; address?: string; dbId?: string; status?: string; lastSeenAt?: string }
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
// The head's view of a single fee row. FeeHistoryItem is the parent's version
// and carries no id, because a parent can only ever read theirs — the head
// needs the id to be able to take a wrong one back off the child's balance.
// planId groups the rows one installment plan created, and is null for the
// ad-hoc fees a head types in one at a time. It exists so a plan set up wrong
// can be taken back in one confirmation instead of six.
export interface FeeRecord { dbId: string; period: string; amount: number; dueDate: string; status: FeeStatus; planId: string | null }
// One line of the sent-reminder log. `when` is pre-formatted by timeAgo at
// fetch time, the same way NotifItem does it.
export interface ReminderLogItem { dbId: string; type: string; message: string; targetClass: string | null; when: string }
export interface NotifItem { icon: string; tint: string; title: string; detail: string; when: string; dbId?: string }
// A leaderboard row. `id` is the student's row id and is what decides who is
// who — two students in the same centre can share a name, and keying the board
// on the name alone merged them into one entry and highlighted the wrong child
// as "(You)". It is null only for a board built by an older snapshot RPC that
// did not return ids.
export interface RankRow { id: string | null; name: string; score: number }
export interface SubjectItem { name: string; dbId: string }
export interface BatchItem { name: string; dbId: string }
export interface BranchReport { name: string; students: number; new_students: number; staff: number; att_pct: number; fees_collected: number; fees_pending: number }
export interface WeeklyReport { generated_at: string; branches: BranchReport[]; unassigned_students: number; tests_this_week: number }
export interface StudentReport { name: string; klass: string; parent: string; fee_status: string; att_present: number; att_total: number; tests: number; avg_pct: number }
export interface TeacherActivity { name: string; email: string; is_head: boolean; attendance_marks: number; tests_entered: number; assignments_created: number }

export interface StaffProfile { name: string; phone: string; subject: string; qualification: string }

export type ToastKind = 'info' | 'error'

export type SupportMessage = { author: 'reporter' | 'operator'; body: string; createdAt: string }
// `intent` is the title - see app/lib/support.ts for why there is no subject.
export interface SupportTicket {
  id: string
  intent: string
  outcome: string
  status: 'open' | 'resolved'
  createdAt: string
  messages: SupportMessage[]
}

export interface State {
  screen: Screen; tab: Tab; role: Role; origin: string | null
  attClass: string; att: Record<string, string>; rankSubject: string; ttDay: string
  // Today's register as the centre currently has it, indexed by student uuid.
  // Derived from rows the provider already fetches, so the Mark Attendance
  // screen can open on what was recorded instead of on a blank slate.
  attToday: Record<string, string>
  // Registers marked with no working connection, mirrored from localStorage.
  // Rendered as a count so she can see her work is still on the phone rather
  // than having to trust that it is.
  attQueue: QueuedBatch[]
  // Queued marks that did not apply because someone else had already answered
  // for that child. Shown, never resolved silently.
  attConflicts: AttConflict[]
  toast: string; toastKind: ToastKind; editId: string
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
  stuTeacherId: string; stuRankSubject: string
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

  teachers: Teacher[]; students: Student[]
  branchesList: BranchItem[]
  meetingsList: MeetingItem[]
  assignmentsList: AssignmentItem[]
  timetableData: Record<string, string[][]>
  schedule: ScheduleItem[]
  rankData: Record<string, RankRow[]>
  subjects: SubjectItem[]
  batches: BatchItem[]
  stuReminders: NotifItem[]
  stuNotifications: NotifItem[]
  stuAttendanceLog: AttLogItem[]
  stuFeeHistory: FeeHistoryItem[]
  // Keyed by student id and filled only for the students whose fees have been
  // opened, so a centre with 300 children does not fetch 300 fee histories to
  // show a list of balances.
  feeRecords: Record<string, FeeRecord[]>
  reminderHistory: ReminderLogItem[]
  stuResults: StuResultItem[]
  stuAssignments: StuAssignmentItem[]
  stuMonthly: { attPresent: number; attTotal: number; tests: number; avgPct: number } | null
  notesList: NoteItem[]
  stuNotes: StuNoteItem[]
  currentStudentDbId: string | null
  stuPendingFee: { amount: string; period: string; dueDate: string; overdue: boolean } | null
  // Counts, not money strings: the fee screen decides whether a student has
  // enough installments for a breakdown to mean anything.
  stuFeeSummary: { outstanding: number; count: number; paidCount: number } | null
  searchQuery: string
  lastAdded: { code: string; name: string; parent: string } | null
  myTickets: SupportTicket[]
  openTicketId: string | null
  reportDraft: ReportDraft
  // The screenshot as a data URL, already downscaled. Held apart from the
  // draft because it is the one field a reporter attaches rather than types.
  reportShot: string | null
}

export interface Actions {
  go: (screen: Screen, tab?: Tab) => void
  goFrom: (screen: Screen, tab: Tab, origin: string) => void
  back: () => void
  notify: (msg: string, kind?: ToastKind) => void
  setReportDraft: (patch: Partial<ReportDraft>) => void
  setReportShot: (file: File | null) => Promise<void>
  loadMyTickets: () => Promise<void>
  fileReport: () => Promise<void>
  openReport: (id: string) => void
  replyToReport: (body: string) => Promise<void>
  dismissToast: () => void
  setOnline: (v: boolean) => void
  set: (partial: Partial<State>) => void

  toggleAtt: (key: string) => void
  setStudentField: (patch: Partial<Student>) => void
  saveStudentEdit: () => Promise<boolean>
  setNewTeacher: (patch: Partial<State['newTeacher']>) => void
  setNewStudent: (patch: Partial<State['newStudent']>) => void
  setStuSignup: (patch: Partial<State['stuSignup']>) => void
  studentSignup: () => Promise<void>
  approveStudent: (dbId: string, klass: string, branchId: string | null, fee: string, feeDue: string, batch?: string) => Promise<void>
  rejectStudent: (dbId: string) => Promise<void>
  deleteStudent: () => Promise<void>
  saveTeacher: () => Promise<void>
  addStudent: () => Promise<void>
  saveAttendance: (roster: Student[]) => Promise<void>
  // Reads the queue off the phone and, if there is a connection, drains it.
  // Safe to call at any time: it is a no-op with nothing waiting.
  syncAttQueue: () => Promise<void>
  dismissAttConflicts: () => void
  saveMeeting: (title: string, type: string, date: string, time: string) => Promise<boolean>
  deleteMeeting: (dbId: string) => Promise<void>
  saveAssignment: (title: string, subject: string, klass: string, dueDate: string, instructions: string) => Promise<boolean>
  deleteAssignment: (dbId: string) => Promise<void>
  saveReminder: (type: string, message: string, targetClass: string, filter?: string) => Promise<void>
  notifyClass: (klass: string, title: string, detail: string, icon: IconName) => Promise<void>
  addFee: (studentDbId: string, amount: number, period: string, dueDate: string) => Promise<boolean>
  addFeePlan: (studentDbId: string, installments: readonly Installment[]) => Promise<boolean>
  deleteFeePlan: (planId: string, studentDbId: string) => Promise<void>
  loadStudentFees: (studentDbId: string) => Promise<void>
  deleteFee: (feeId: string, studentDbId: string) => Promise<void>
  loadReminderHistory: () => Promise<void>
  toggleFeeStatus: (key: string) => Promise<void>
  addTimetableEntry: (day: string, startTime: string, endTime: string, subject: string, klass: string, room: string, teacherId: string) => Promise<boolean>
  deleteTimetableEntry: (day: string, p: string[]) => Promise<void>
  updateTimetableEntry: (day: string, oldP: string[], startTime: string, endTime: string, subject: string, klass: string, room: string, teacherId: string) => Promise<boolean>
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
  devDeleteCentre: (centreId: string, confirm: string) => Promise<void>
  devReplyTicket: (ticketId: string, message: string) => Promise<void>
  devResolveTicket: (ticketId: string) => Promise<void>
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
