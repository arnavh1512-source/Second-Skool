import type { Role, Screen, StaffStatus } from './types'

// Landing screen for a signed-in staff user. Pure, because finishing the
// profile setup has to re-run exactly this decision to know where to go next.
export function landingScreen(role: Role, staffStatus: StaffStatus, profileDone: boolean): Screen {
  if (staffStatus === 'rejected') return 'denied'
  // Details before anything else. A join request reaches the head carrying
  // this person's name and number; whatever Google had on file — an alias, a
  // first name, an email prefix — is not something the head can act on.
  if (!profileDone) return 'profileSetup'
  if ((role === 'admin' || role === 'teacher') && staffStatus === 'approved') return 'home'
  if (role === 'teacher' && staffStatus === 'pending') return 'pending'
  return 'register' // unregistered staff (role 'student' / status 'none')
}
