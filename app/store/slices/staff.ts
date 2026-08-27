import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/log'
import { removeLocal } from '../../lib/storage'
import { changedNothing, NOT_SAVED } from '../db'
import { friendlyError } from '../errors'
import { initialState } from '../initial-state'
import { landingScreen } from '../navigation'
import { MIN_PASSWORD_LENGTH, passwordTooShort } from '../validate'
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
      .select('id, full_name, email, role, staff_status, phone, subject, qualification')
      .neq('staff_status', 'none')
      .order('created_at', { ascending: false })
    if (error) { logError('staff.load_failed', { message: error.message }); get().notify(friendlyError(error, 'load the staff list'), 'error'); return }
    const list: StaffMember[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, name: r.full_name as string, email: (r.email as string) ?? '',
      role: r.role as string, status: r.staff_status as StaffStatus,
      phone: (r.phone as string) ?? '', subject: (r.subject as string) ?? '', qualification: (r.qualification as string) ?? '',
    }))
    set({ staffList: list })
  },

  approveTeacher: async (id) => {
    const { error } = await supabase.rpc('approve_teacher', { p_id: id })
    if (error) { get().notify('Could not approve', 'error'); return }
    get().notify('Teacher approved'); await get().loadStaff()
  },

  rejectTeacher: async (id) => {
    const { error } = await supabase.rpc('reject_teacher', { p_id: id })
    if (error) { get().notify('Could not reject', 'error'); return }
    get().notify('Teacher rejected'); await get().loadStaff()
  },

  grantHead: async (id) => {
    const { error } = await supabase.rpc('grant_head', { p_id: id })
    if (error) { get().notify('Could not grant head access', 'error'); return }
    get().notify('Head access granted'); await get().loadStaff()
  },

  removeStaff: async (id) => {
    const { error } = await supabase.rpc('remove_staff', { p_id: id })
    if (error) { get().notify('Could not remove', 'error'); return }
    get().notify('Access removed'); await get().loadStaff()
  },

  // Wipe every piece of state back to the initial value rather than listing the
  // keys to clear. The hand-written list this replaced had fallen six keys
  // behind the store — centre name, logo, join code and the three report
  // objects survived a sign-out, so on a shared device the next head saw the
  // previous centre's data until their own load landed. Spreading initialState
  // means a key added to a slice tomorrow is cleared here for free.
  signOut: () => {
    supabase.auth.signOut()
    removeLocal('student_code')
    set({
      ...initialState,
      // The two things that must not come back as their initial value: the app
      // has finished deciding who you are (it is nobody), and you land on the
      // sign-in screen rather than the pre-auth splash.
      authLoading: false,
      screen: 'home' as Screen,
      tab: 'home' as Tab,
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
    // Was a bare `return false`: the button went back to "Continue" and nothing
    // else happened, which is the exact shape of the bug QA hit — a form that
    // swallows the tap and never says why.
    if (!id) { get().notify('You are signed out — sign in again', 'error'); return false }
    const trimmed = name.trim()
    if (trimmed.length < 2) { get().notify('Please enter your full name', 'error'); return false }
    const tel = phone.trim()
    if (!/^\+?\d[\d\s-]{6,}$/.test(tel)) { get().notify('Enter a valid phone number', 'error'); return false }
    const sub = subject.trim(), qual = qualification.trim()
    if (sub.length < 2) { get().notify('Enter the subject you teach', 'error'); return false }
    if (qual.length < 2) { get().notify('Enter your qualification', 'error'); return false }

    const res = await supabase.from('profiles').update({
      full_name: trimmed.slice(0, 120), phone: tel,
      subject: sub.slice(0, 120), qualification: qual.slice(0, 120),
      // Stamped on every save, not only the first. Re-stamping a complete
      // profile costs nothing, and it means a row that somehow missed the
      // marker heals on the next edit instead of trapping someone in setup.
      profile_completed_at: new Date().toISOString(),
    }).eq('id', id).select('id')
    if (res.error) { get().notify('Could not save profile — check your connection', 'error'); return false }
    // The row must exist — it is the signed-in user's own profile. Zero rows
    // means the write was filtered out, and claiming success there would send a
    // teacher onward with an empty profile and no way back.
    if (changedNothing(res)) { get().notify(NOT_SAVED, 'error'); return false }

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
    if (passwordTooShort(password)) { get().notify(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'error'); return false }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { get().notify(error.message || 'Could not set password', 'error'); return false }
    get().notify('Password set — you can now sign in with your email')
    return true
  },
})
