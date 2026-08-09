'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import type { ComponentType } from 'react'
import { useDashboard, type Screen } from './store'
import { PhoneFrame } from './components/Shell'
import { DesktopShell, DesktopAuthShell, useIsDesktop } from './components/DesktopShell'
import { SupabaseProvider } from './components/SupabaseProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoginScreen, ProfileSetupScreen, RegisterScreen, PendingScreen, DeniedScreen, StuPendingScreen, StuDeniedScreen } from './components/AuthScreens'
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
      </SupabaseProvider>
    </ErrorBoundary>
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
}

function ScreenRouter() {
  const { screen, role, dataLoading, staffStatus, supabaseUserId, profileDone } = useDashboard()

  useEffect(() => {
    let label: string | undefined
    if (!role) label = 'Sign in'
    else if (supabaseUserId && staffStatus === 'rejected') label = 'Access denied'
    else if (supabaseUserId && !profileDone) label = 'Your details'
    else if (supabaseUserId && staffStatus !== 'approved')
      label = staffStatus === 'pending' ? 'Pending approval' : 'Complete setup'
    else label = SCREEN_TITLES[screen]
    document.title = label ? `${label} · Second Skool` : 'Second Skool'
  }, [screen, role, staffStatus, supabaseUserId, profileDone])

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
    default: return <HomeScreen />
  }
}
