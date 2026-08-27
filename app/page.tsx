'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { useDashboard, type Screen } from './store'
import { PhoneFrame } from './components/Shell'
import { Icon } from './components/Icon'
import { DesktopShell, DesktopAuthShell, useIsDesktop } from './components/DesktopShell'
import { SupabaseProvider } from './components/SupabaseProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ConnectionStatus } from './components/ConnectionStatus'
import { InstallPrompt } from './components/InstallPrompt'
import { LoginScreen, ProfileSetupScreen, RegisterScreen, PendingScreen, DeniedScreen, StuPendingScreen, StuDeniedScreen, NotificationGateScreen, useNotificationGate } from './components/AuthScreens'
import { HomeScreen } from './components/HomeScreen'

function ScreenLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-[3px] border-[#e6eaf2] border-t-[#2a6fdb] rounded-full animate-spin" />
    </div>
  )
}

const dyn = (importFn: () => Promise<Record<string, ComponentType>>, name: string) =>
  dynamic(() => importFn().then(m => ({ default: m[name] })), { loading: ScreenLoading })

const StaffApprovalsScreen = dyn(() => import('./components/AdminScreens'), 'StaffApprovalsScreen')
const StudentRequestsScreen = dyn(() => import('./components/AdminScreens'), 'StudentRequestsScreen')
const ReportsScreen = dyn(() => import('./components/AdminScreens'), 'ReportsScreen')
const DevConsoleScreen = dyn(() => import('./components/DevConsole'), 'DevConsoleScreen')

const TimetableScreen = dyn(() => import('./components/TeachingScreens'), 'TimetableScreen')
const AttendanceScreen = dyn(() => import('./components/TeachingScreens'), 'AttendanceScreen')
const ResultsScreen = dyn(() => import('./components/TeachingScreens'), 'ResultsScreen')
const AssignmentsScreen = dyn(() => import('./components/TeachingScreens'), 'AssignmentsScreen')
const RemindersScreen = dyn(() => import('./components/TeachingScreens'), 'RemindersScreen')

const StudentsScreen = dyn(() => import('./components/PeopleScreens'), 'StudentsScreen')
const EditStudentScreen = dyn(() => import('./components/PeopleScreens'), 'EditStudentScreen')
const AddStudentScreen = dyn(() => import('./components/PeopleScreens'), 'AddStudentScreen')
const StaffScreen = dyn(() => import('./components/PeopleScreens'), 'StaffScreen')
const AddTeacherScreen = dyn(() => import('./components/PeopleScreens'), 'AddTeacherScreen')

const FeesScreen = dyn(() => import('./components/UtilityScreens'), 'FeesScreen')
const MeetingsScreen = dyn(() => import('./components/UtilityScreens'), 'MeetingsScreen')
const RankingsScreen = dyn(() => import('./components/UtilityScreens'), 'RankingsScreen')
const BranchesScreen = dyn(() => import('./components/UtilityScreens'), 'BranchesScreen')
const SubjectsScreen = dyn(() => import('./components/UtilityScreens'), 'SubjectsScreen')
const BatchesScreen = dyn(() => import('./components/UtilityScreens'), 'BatchesScreen')
const MoreScreen = dyn(() => import('./components/UtilityScreens'), 'MoreScreen')
const StaffProfileScreen = dyn(() => import('./components/UtilityScreens'), 'StaffProfileScreen')
const NotificationsScreen = dyn(() => import('./components/UtilityScreens'), 'NotificationsScreen')

const SupportScreen = dyn(() => import('./components/SupportScreens'), 'SupportScreen')
const SupportThreadScreen = dyn(() => import('./components/SupportScreens'), 'SupportThreadScreen')

const StuHomeScreen = dyn(() => import('./components/StudentScreens'), 'StuHomeScreen')
const StuAttendanceScreen = dyn(() => import('./components/StudentScreens'), 'StuAttendanceScreen')
const StuResultsScreen = dyn(() => import('./components/StudentScreens'), 'StuResultsScreen')
const StuRankingScreen = dyn(() => import('./components/StudentScreens'), 'StuRankingScreen')
const StuTeachersScreen = dyn(() => import('./components/StudentScreens'), 'StuTeachersScreen')
const StuTeacherDetail = dyn(() => import('./components/StudentScreens'), 'StuTeacherDetail')
const StuFeesScreen = dyn(() => import('./components/StudentScreens'), 'StuFeesScreen')
const StuNotifScreen = dyn(() => import('./components/StudentScreens'), 'StuNotifScreen')
const StuProfileScreen = dyn(() => import('./components/StudentScreens'), 'StuProfileScreen')
const StuTimetableScreen = dyn(() => import('./components/StudentScreens'), 'StuTimetableScreen')
const StuAssignmentsScreen = dyn(() => import('./components/StudentScreens'), 'StuAssignmentsScreen')
const NotesScreen = dyn(() => import('./components/NotesScreens'), 'NotesScreen')
const StuNotesScreen = dyn(() => import('./components/NotesScreens'), 'StuNotesScreen')

export default function Page() {
  return (
    <ErrorBoundary>
      <SupabaseProvider>
        <AppShell>
          <ScreenRouter />
        </AppShell>
        <ConnectionStatus />
        <InstallPrompt />
        <OperatorEntry />
      </SupabaseProvider>
    </ErrorBoundary>
  )
}

// The one way into the developer console. It is not a screen in the router:
// the operator owns no centre, so every gate in ScreenRouter would turn them
// away before any screen rendered. A floating pill sidesteps that and needs no
// place in the staff navigation, which the operator never sees either.
// Visibility comes from a server probe — the allowlist never reaches the
// browser, and /api/dev re-checks it on the request that actually returns data.
function OperatorEntry() {
  const { supabaseUserId, devAllowed, devConsoleOpen, checkDevAccess, openDevConsole } = useDashboard()

  useEffect(() => { if (supabaseUserId) void checkDevAccess() }, [supabaseUserId, checkDevAccess])

  if (!devAllowed) return null
  // Full-page overlay rather than a screen inside the phone frame: this is a
  // wide data view, and it scrolls itself so the app's mobile scroll-lock on
  // <body> doesn't apply.
  if (devConsoleOpen) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-td-bg">
        <div className="mx-auto max-w-5xl">
          <DevConsoleScreen />
        </div>
      </div>
    )
  }
  return (
    <button
      onClick={openDevConsole}
      aria-label="Open developer console"
      className="fixed right-3 bottom-24 z-50 md:bottom-6 flex items-center gap-1.5 rounded-full bg-td-dark text-white text-[12px] font-extrabold py-2.5 px-4 border-none cursor-pointer shadow-[0_6px_20px_rgba(20,30,60,.28)] max-w-[70vw]"
    >
      <Icon name="console" size={15} className="shrink-0" />Console
    </button>
  )
}

// Laptop layout: approved staff get the wide sidebar console; the pre-app
// screens (login, and staff setup/pending/denied) get the split-screen auth
// shell. Students and every mobile viewport keep the phone layout.
function AppShell({ children }: { children: React.ReactNode }) {
  const { role, staffStatus, supabaseUserId, profileDone } = useDashboard()
  const desktop = useIsDesktop()
  const isStaff = role === 'admin' || role === 'teacher'
  // An approved head with an unfinished profile is still on a pre-app screen —
  // wrapping the details form in the console sidebar would offer navigation
  // out of a gate that exists to be answered.
  const approvedStaff = isStaff && !(supabaseUserId && (staffStatus !== 'approved' || !profileDone))
  if (desktop) {
    if (approvedStaff) return <DesktopShell>{children}</DesktopShell>
    if (role !== 'student') return <DesktopAuthShell>{children}</DesktopAuthShell>
  }
  return <PhoneFrame>{children}</PhoneFrame>
}

// Human labels for each client-routed screen — used to keep the browser tab /
// history title in sync with what's actually on screen (this is a single Next
// route, so per-page metadata can't do it).
const SCREEN_TITLES: Partial<Record<Screen, string>> = {
  home: 'Home', timetable: 'Timetable', attendance: 'Attendance', results: 'Results',
  assign: 'Assignments', reminder: 'Reminders', students: 'Students', editStudent: 'Edit student',
  addStudent: 'Add student', teachers: 'Staff', addTeacher: 'Add teacher', fees: 'Fees',
  meetings: 'Meetings', rankings: 'Rankings', branches: 'Branches', subjects: 'Subjects',
  batches: 'Batches', notes: 'Study material', more: 'More', staffApprovals: 'Staff approvals',
  studentRequests: 'Student requests', staffProfile: 'Profile', notifications: 'Notifications',
  reports: 'Reports', stuHome: 'Home', stuAttendance: 'Attendance', stuResults: 'Results',
  stuRanking: 'Ranking', stuTeachers: 'Teachers', stuTeacher: 'Teacher', stuFees: 'Fees',
  stuNotif: 'Notifications', stuProfile: 'Profile', stuTimetable: 'Timetable',
  stuAssignments: 'Assignments', stuNotes: 'Study material',
  support: 'Report a problem', supportThread: 'Your report',
}

function ScreenRouter() {
  const { screen, role, dataLoading, staffStatus, supabaseUserId, profileDone } = useDashboard()
  const notifGated = useNotificationGate()

  useEffect(() => {
    let label: string | undefined
    if (!role) label = 'Sign in'
    else if (supabaseUserId && staffStatus === 'rejected') label = 'Access denied'
    else if (supabaseUserId && !profileDone) label = 'Your details'
    else if (supabaseUserId && staffStatus !== 'approved')
      label = staffStatus === 'pending' ? 'Pending approval' : 'Complete setup'
    else if (role === 'student' && notifGated && screen !== 'stuDenied') label = 'Turn on reminders'
    else label = SCREEN_TITLES[screen]
    document.title = label ? `${label} · Second Skool` : 'Second Skool'
  }, [screen, role, staffStatus, supabaseUserId, profileDone, notifGated])

  if (!role) return <LoginScreen />

  // Details gate, ahead of the status lock below — which would otherwise send
  // an unregistered or pending user straight past it. Rejected users are
  // exempt: there's nothing for them to complete.
  if (supabaseUserId && !profileDone && staffStatus !== 'rejected') return <ProfileSetupScreen />

  // A signed-in Google user who is not an approved staff member is locked to
  // their setup/status screen — no access to any feature screen, regardless of
  // the stored `screen` (prevents tab navigation into the app before approval).
  if (supabaseUserId && staffStatus !== 'approved') {
    if (staffStatus === 'pending') return <PendingScreen />
    if (staffStatus === 'rejected') return <DeniedScreen />
    return <RegisterScreen />
  }

  // Students must have reminders on, full stop — the browser won't make that
  // mandatory, so the app does. Not applied to the declined screen: someone the
  // centre already turned away has nothing to be reminded about.
  if (role === 'student' && notifGated && screen !== 'stuDenied') return <NotificationGateScreen />

  if (dataLoading && (role === 'admin' || role === 'teacher')) return <ScreenLoading />

  switch (screen) {
    case 'home': return <HomeScreen />
    case 'timetable': return <TimetableScreen />
    case 'attendance': return <AttendanceScreen />
    case 'results': return <ResultsScreen />
    case 'assign': return <AssignmentsScreen />
    case 'reminder': return <RemindersScreen />
    case 'students': return <StudentsScreen />
    case 'editStudent': return <EditStudentScreen />
    case 'addStudent': return <AddStudentScreen />
    case 'teachers': return <StaffScreen />
    case 'addTeacher': return <AddTeacherScreen />
    case 'fees': return <FeesScreen />
    case 'meetings': return <MeetingsScreen />
    case 'rankings': return <RankingsScreen />
    case 'branches': return <BranchesScreen />
    case 'subjects': return <SubjectsScreen />
    case 'batches': return <BatchesScreen />
    case 'notes': return <NotesScreen />
    case 'more': return <MoreScreen />
    case 'staffProfile': return <StaffProfileScreen />
    case 'notifications': return <NotificationsScreen />
    case 'staffApprovals': return <StaffApprovalsScreen />
    case 'studentRequests': return <StudentRequestsScreen />
    case 'reports': return <ReportsScreen />
    case 'profileSetup': return <ProfileSetupScreen />
    case 'register': return <RegisterScreen />
    case 'pending': return <PendingScreen />
    case 'denied': return <DeniedScreen />
    case 'stuPending': return <StuPendingScreen />
    case 'stuDenied': return <StuDeniedScreen />
    case 'stuHome': return <StuHomeScreen />
    case 'stuAttendance': return <StuAttendanceScreen />
    case 'stuResults': return <StuResultsScreen />
    case 'stuRanking': return <StuRankingScreen />
    case 'stuTeachers': return <StuTeachersScreen />
    case 'stuTeacher': return <StuTeacherDetail />
    case 'stuFees': return <StuFeesScreen />
    case 'stuNotif': return <StuNotifScreen />
    case 'stuProfile': return <StuProfileScreen />
    case 'stuTimetable': return <StuTimetableScreen />
    case 'stuAssignments': return <StuAssignmentsScreen />
    case 'stuNotes': return <StuNotesScreen />
    case 'support': return <SupportScreen />
    case 'supportThread': return <SupportThreadScreen />
    default: return <HomeScreen />
  }
}
