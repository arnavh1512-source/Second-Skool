'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { useDashboard } from './store'
import { PhoneFrame } from './components/Shell'
import { DesktopShell, DesktopAuthShell, useIsDesktop } from './components/DesktopShell'
import { SupabaseProvider } from './components/SupabaseProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoginScreen, RegisterScreen, PendingScreen, DeniedScreen, StuPendingScreen } from './components/AuthScreens'
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
const MoreScreen = dyn(() => import('./components/UtilityScreens'), 'MoreScreen')
const StaffProfileScreen = dyn(() => import('./components/UtilityScreens'), 'StaffProfileScreen')

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
  const { role, staffStatus, supabaseUserId } = useDashboard()
  const desktop = useIsDesktop()
  const isStaff = role === 'admin' || role === 'teacher'
  const approvedStaff = isStaff && !(supabaseUserId && staffStatus !== 'approved')
  if (desktop) {
    if (approvedStaff) return <DesktopShell>{children}</DesktopShell>
    if (role !== 'student') return <DesktopAuthShell>{children}</DesktopAuthShell>
  }
  return <PhoneFrame>{children}</PhoneFrame>
}

function ScreenRouter() {
  const { screen, role, dataLoading, staffStatus, supabaseUserId } = useDashboard()

  if (!role) return <LoginScreen />

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
    case 'notes': return <NotesScreen />
    case 'more': return <MoreScreen />
    case 'staffProfile': return <StaffProfileScreen />
    case 'staffApprovals': return <StaffApprovalsScreen />
    case 'studentRequests': return <StudentRequestsScreen />
    case 'reports': return <ReportsScreen />
    case 'register': return <RegisterScreen />
    case 'pending': return <PendingScreen />
    case 'denied': return <DeniedScreen />
    case 'stuPending': return <StuPendingScreen />
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
