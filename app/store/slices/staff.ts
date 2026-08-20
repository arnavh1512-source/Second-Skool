import { supabase } from '../../lib/supabase'
import { landingScreen } from '../navigation'
import type { Slice } from '../slice'
import type { Screen, StaffMember, StaffStatus, Tab } from '../types'

type Keys =
  | 'loadStaff' | 'approveTeacher' | 'rejectTeacher' | 'grantHead' | 'removeStaff'
  | 'signOut' | 'setAuth' | 'saveStaffProfile' | 'setMyPassword'

export const createStaffSlice: Slice<Keys> = (set, get) => ({
  loadStaff: async () => {
    // Read profiles directly — RLS already lets an authenticated head view all
    // profiles, and this avoids any dependency on the list_staff RPC being
    // present/healthy in the live DB.
    const { data, error } = await supabase
      .from('profiles')
      // Phone/subject/qualification are what the applicant typed about
      // themselves — without them an approval decision is made on a Google
      // display name alone, which is no basis for granting roster access.
      .select('id, full_name, email, role, staff_status, head_requested, phone, subject, qualification')
      .neq('staff_status', 'none')
      .order('created_at', { ascending: false })
    if (error) { console.error('loadStaff failed:', error.message); get().notify(`Could not load staff: ${error.message}`); return }
    const list: StaffMember[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, name: r.full_name as string, email: (r.email as string) ?? '',
      role: r.role as string, status: r.staff_status as StaffStatus, headRequested: !!r.head_requested,
      phone: (r.phone as string) ?? '', subject: (r.subject as string) ?? '', qualification: (r.qualification as string) ?? '',
    }))
    set({ staffList: list })
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

  signOut: () => {
    supabase.auth.signOut()
    if (typeof window !== 'undefined') localStorage.removeItem('student_code')
    set({
      role: null, googleEmail: '', screen: 'home' as Screen, tab: 'home' as Tab,
      supabaseUserId: null, staffStatus: 'none', headExists: false, staffList: [], devAllowed: null, devConsoleOpen: false, devSeat: null,
      teachers: [], students: [], branchesList: [], meetingsList: [], assignmentsList: [],
      timetableData: {}, schedule: [], rankData: {}, subjects: [], batches: [],
      stuReminders: [], stuNotifications: [], stuAttendanceLog: [], stuFeeHistory: [], stuResults: [], stuAssignments: [], stuMonthly: null, stuNotes: [],
      currentStudentDbId: null, stuPendingFee: null, stuPending: null, stuDenied: null, pendingStudents: [], studentJoinCode: '',
    })
    get().notify('Signed out')
  },

  setAuth: (userId, role, email, staffStatus, headExists, profile = {}) => {
    const { name = '', phone = '', subject = '', qualification = '', done = false } = profile
    set({
      supabaseUserId: userId, role, staffStatus, headExists, authLoading: false,
      googleEmail: email ?? '', myName: name, myPhone: phone, mySubject: subject, myQualification: qualification,
      profileDone: done, screen: landingScreen(role, staffStatus, done), tab: 'home',
    })
  },

  saveStaffProfile: async ({ name, phone, subject, qualification }) => {
    const id = get().supabaseUserId
    if (!id) return false
    const trimmed = name.trim()
    if (trimmed.length < 2) { get().notify('Please enter your full name'); return false }
    const tel = phone.trim()
    if (!/^\+?\d[\d\s-]{6,}$/.test(tel)) { get().notify('Enter a valid phone number'); return false }
    const sub = subject.trim(), qual = qualification.trim()
    if (sub.length < 2) { get().notify('Enter the subject you teach'); return false }
    if (qual.length < 2) { get().notify('Enter your qualification'); return false }

    const { error } = await supabase.from('profiles').update({
      full_name: trimmed.slice(0, 120), phone: tel,
      subject: sub.slice(0, 120), qualification: qual.slice(0, 120),
      // Stamped on every save, not only the first. Re-stamping a complete
      // profile costs nothing, and it means a row that somehow missed the
      // marker heals on the next edit instead of trapping someone in setup.
      profile_completed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { get().notify('Could not save profile — check your connection'); return false }

    const wasSetup = !get().profileDone
    set({ myName: trimmed, myPhone: tel, mySubject: sub, myQualification: qual, profileDone: true })
    get().notify(wasSetup ? 'Profile saved' : 'Profile updated')
    // Finishing setup has to resume the journey the gate interrupted —
    // registering, waiting for approval, or straight to home.
    if (wasSetup) set({ screen: landingScreen(get().role, get().staffStatus, true), tab: 'home' })
    return true
  },

  // Set (or change) an email+password sign-in for a staff member. Lets a
  // Google-created head/teacher pick a password once, then sign in on the
  // installed PWA with email+password — a fully in-app flow that survives
  // relaunches (unlike Google's redirect, which escapes to the browser).
  setMyPassword: async (password) => {
    if (password.length < 8) { get().notify('Password must be at least 8 characters'); return false }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { get().notify(error.message || 'Could not set password'); return false }
    get().notify('Password set — you can now sign in with your email')
    return true
  },
})
