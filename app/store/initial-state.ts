import type { State } from './types'

// Every default in one place. Slices contribute behaviour only, so there is
// exactly one file to read when asking "what does the store start as?".
export const initialState: State = {
  screen: 'home', tab: 'home', role: null, origin: null,
  attClass: '', att: {}, rankSubject: '', ttDay: ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()],
  toast: '', toastKind: 'info', editId: '',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastSyncedAt: null,
  staffStatus: 'none', headExists: false, staffList: [], weeklyReport: null, studentReports: null, teacherActivity: null,
  googleEmail: '', myName: '', myPhone: '', mySubject: '', myQualification: '', profileDone: true,
  centreName: '', centreLogo: '', joinCode: '', studentJoinCode: '', reminderType: 'Test', plan: 'Monthly',
  newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' },
  newStudent: { name: '', school: '', klass: 'Class 10', batch: '', branch: '', parent: '', address: '', fee: '', feeDue: '' },
  stuSignup: { joinCode: '', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
  stuPending: null, stuDenied: null, pendingStudents: [],
  teachers: [], students: [],
  stuTeacherId: '', stuRankSubject: '',
  supabaseUserId: null, authLoading: true, dataLoading: false, devAllowed: null, devConsoleOpen: false,

  branchesList: [], meetingsList: [], assignmentsList: [],
  timetableData: {}, schedule: [], rankData: {}, subjects: [], batches: [],
  stuReminders: [], stuNotifications: [], stuAttendanceLog: [],
  stuFeeHistory: [], stuResults: [], stuAssignments: [], stuMonthly: null,
  notesList: [], stuNotes: [], feeRecords: {}, reminderHistory: [],
  currentStudentDbId: null, stuPendingFee: null, stuFeeSummary: null, searchQuery: '', lastAdded: null,
  myTickets: [], openTicketId: null, reportShot: null,
  reportDraft: { intent: '', outcome: '', area: '', frequency: 'always' },
}
