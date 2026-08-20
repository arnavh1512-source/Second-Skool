// The dashboard store. Behaviour lives in app/store/slices/* — one file per
// domain — and this module composes them and stays the single import path for
// the whole app, so a screen keeps writing `from '../store'` regardless of
// which slice an action happens to live in.
import { create } from 'zustand'

import { initialState } from './store/initial-state'
import type { Store } from './store/types'

import { createAcademicsSlice } from './store/slices/academics'
import { createAttendanceSlice } from './store/slices/attendance'
import { createCentreSlice } from './store/slices/centre'
import { createDataSlice } from './store/slices/data'
import { createFeesSlice } from './store/slices/fees'
import { createNavSlice } from './store/slices/nav'
import { createNotesSlice } from './store/slices/notes'
import { createNotificationsSlice } from './store/slices/notifications'
import { createOperatorSlice } from './store/slices/operator'
import { createReportsSlice } from './store/slices/reports'
import { createScheduleSlice } from './store/slices/schedule'
import { createStaffSlice } from './store/slices/staff'
import { createStudentsSlice } from './store/slices/students'
import { createTeachersSlice } from './store/slices/teachers'

export const useDashboard = create<Store>()((...a) => ({
  ...initialState,
  ...createNavSlice(...a),
  ...createDataSlice(...a),
  ...createStudentsSlice(...a),
  ...createTeachersSlice(...a),
  ...createAttendanceSlice(...a),
  ...createFeesSlice(...a),
  ...createScheduleSlice(...a),
  ...createAcademicsSlice(...a),
  ...createNotesSlice(...a),
  ...createNotificationsSlice(...a),
  ...createCentreSlice(...a),
  ...createOperatorSlice(...a),
  ...createStaffSlice(...a),
  ...createReportsSlice(...a),
}))

// --- Public surface ---
// Re-exported so every existing `from '../store'` import keeps resolving.
export * from './store/types'
export * from './store/format'
export * from './store/constants'
export { genStudentCode } from './store/codes'
export { landingScreen } from './store/navigation'
export { mapSnapshot } from './store/snapshot'
export { registerRefresh } from './store/refresh'
