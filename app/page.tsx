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
      <div className="w-8 h-8 border-[3px] border-td-border border-t-td-primary rounded-full animate-spin" />
    </div>
  )
}

const dyn = (importFn: () => Promise<Record<string, ComponentType>>, name: string) =>
  dynamic(() => importFn().then(m => ({ default: m[name] })), { loading: ScreenLoading })

const DevConsoleScreen = dyn(() => import('./components/DevConsole'), 'DevConsoleScreen')

const admin = () => import('./components/AdminScreens')
const teaching = () => import('./components/TeachingScreens')
const people = () => import('./components/PeopleScreens')
const utility = () => import('./components/UtilityScreens')
const fees = () => import('./components/FeesScreens')
const setup = () => import('./components/SetupScreens')
const support = () => import('./components/SupportScreens')
const student = () => import('./components/StudentScreens')
const notes = () => import('./components/NotesScreens')

// Every client-routed screen: what renders it, and the human label that keeps
// the browser tab / history title in sync with what's on screen (this is a
// single Next route, so per-page metadata can't do it). A screen with no title
// is one of the pre-app gates, which get their label from the gate itself.
//
// One table rather than a lazy-import list, a title map and a switch, all keyed
// on the same union: `Record<Screen, …>` makes a missing screen a type error,
// which a switch with a `default` never could.
const SCREENS: Record<Screen, { view: ComponentType; title?: string }> = {
  home: { view: HomeScreen, title: 'Home' },
  timetable: { view: dyn(teaching, 'TimetableScreen'), title: 'Timetable' },
  attendance: { view: dyn(teaching, 'AttendanceScreen'), title: 'Attendance' },
  results: { view: dyn(teaching, 'ResultsScreen'), title: 'Results' },
  assign: { view: dyn(teaching, 'AssignmentsScreen'), title: 'Assignments' },
  reminder: { view: dyn(teaching, 'RemindersScreen'), title: 'Reminders' },
  students: { view: dyn(people, 'StudentsScreen'), title: 'Students' },
  editStudent: { view: dyn(people, 'EditStudentScreen'), title: 'Edit student' },
  addStudent: { view: dyn(people, 'AddStudentScreen'), title: 'Add student' },
  teachers: { view: dyn(people, 'StaffScreen'), title: 'Staff' },
  addTeacher: { view: dyn(people, 'AddTeacherScreen'), title: 'Add teacher' },
  fees: { view: dyn(fees, 'FeesScreen'), title: 'Fees' },
  meetings: { view: dyn(utility, 'MeetingsScreen'), title: 'Meetings' },
  rankings: { view: dyn(utility, 'RankingsScreen'), title: 'Rankings' },
  branches: { view: dyn(setup, 'BranchesScreen'), title: 'Branches' },
  subjects: { view: dyn(setup, 'SubjectsScreen'), title: 'Subjects' },
  batches: { view: dyn(setup, 'BatchesScreen'), title: 'Batches' },
  notes: { view: dyn(notes, 'NotesScreen'), title: 'Study material' },
  more: { view: dyn(utility, 'MoreScreen'), title: 'More' },
  staffProfile: { view: dyn(utility, 'StaffProfileScreen'), title: 'Profile' },
  notifications: { view: dyn(utility, 'NotificationsScreen'), title: 'Notifications' },
  staffApprovals: { view: dyn(admin, 'StaffApprovalsScreen'), title: 'Staff approvals' },
  studentRequests: { view: dyn(admin, 'StudentRequestsScreen'), title: 'Student requests' },
  reports: { view: dyn(admin, 'ReportsScreen'), title: 'Reports' },
  support: { view: dyn(support, 'SupportScreen'), title: 'Report a problem' },
  supportThread: { view: dyn(support, 'SupportThreadScreen'), title: 'Your report' },

  stuHome: { view: dyn(student, 'StuHomeScreen'), title: 'Home' },
  stuAttendance: { view: dyn(student, 'StuAttendanceScreen'), title: 'Attendance' },
  stuResults: { view: dyn(student, 'StuResultsScreen'), title: 'Results' },
  stuRanking: { view: dyn(student, 'StuRankingScreen'), title: 'Ranking' },
  stuTeachers: { view: dyn(student, 'StuTeachersScreen'), title: 'Teachers' },
  stuTeacher: { view: dyn(student, 'StuTeacherDetail'), title: 'Teacher' },
  stuFees: { view: dyn(student, 'StuFeesScreen'), title: 'Fees' },
  stuNotif: { view: dyn(student, 'StuNotifScreen'), title: 'Notifications' },
  stuProfile: { view: dyn(student, 'StuProfileScreen'), title: 'Profile' },
  stuTimetable: { view: dyn(student, 'StuTimetableScreen'), title: 'Timetable' },
  stuAssignments: { view: dyn(student, 'StuAssignmentsScreen'), title: 'Assignments' },
  stuNotes: { view: dyn(notes, 'StuNotesScreen'), title: 'Study material' },

  // Pre-app gates. Reachable as a stored `screen`, so they render, but their
  // tab title is set by the gate branches in ScreenRouter instead.
  profileSetup: { view: ProfileSetupScreen },
  register: { view: RegisterScreen },
  pending: { view: PendingScreen },
  denied: { view: DeniedScreen },
  stuPending: { view: StuPendingScreen },
  stuDenied: { view: StuDeniedScreen },

  // Never navigated to: 'admin' predates the role split and 'stuSignup' is a
  // step inside LoginScreen. Both land on home, as they always have.
  admin: { view: HomeScreen },
  stuSignup: { view: HomeScreen },
}

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
      className="fixed right-3 bottom-24 z-50 md:bottom-6 flex items-center gap-1.5 rounded-full bg-td-ink text-white text-[12px] font-extrabold py-2.5 px-4 border-none cursor-pointer shadow-[0_6px_20px_rgba(20,30,60,.28)] max-w-[70vw]"
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
    else label = SCREENS[screen]?.title
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

  // `?? home` covers a screen name left in localStorage by an older build.
  const View = (SCREENS[screen] ?? SCREENS.home).view
  return <View />
}
