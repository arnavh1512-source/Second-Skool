import type { State } from './types'

// Every default in one place. Slices contribute behaviour only, so there is
// exactly one file to read when asking "what does the store start as?".
export const initialState: State = {
  screen: 'home', tab: 'home', role: null, origin: null,
  // Seeded empty rather than from localStorage on purpose: this module is
  // evaluated on the server too, and a queue that exists on the client but not
  // in the server render is a hydration mismatch. `syncAttQueue` fills it on
  // mount, which is a client effect and cannot disagree with the markup.
  attQueue: [], attConflicts: [], attToday: {}, atRisk: {},
  attClass: '', att: {}, rankSubject: '', rankClass: '', ttDay: ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()],
  toast: '', toastKind: 'info', editId: '',
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastSyncedAt: null,
  staffStatus: 'none', headExists: false, staffList: [], weeklyReport: null, studentReports: null, teacherActivity: null,
  googleEmail: '', myName: '', myPhone: '', mySubject: '', myQualification: '', profileDone: true,
  centreName: '', centreLogo: '', joinCode: '', studentJoinCode: '', reminderType: 'Test', plan: 'Monthly',
  newTeacher: { name: '', subject: '', qualification: '', experience: '', branch: '' },
  newStudent: { name: '', school: '', klass: 'Class 10', batch: '', branch: '', parent: '', address: '', fee: '', feeDue: '' },
  stuSignup: { joinCode: '', name: '', parent: '', klass: 'Class 10', school: '', address: '' },
  stuPending: null, stuDenied: null, pendingStudents: [], studentDevices: [],
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
