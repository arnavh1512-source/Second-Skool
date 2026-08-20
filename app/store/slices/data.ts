import { runRefresh } from '../refresh'
import type { Slice } from '../slice'

// The bridge to SupabaseProvider's full-dataset fetch. Kept separate from the
// domain slices because every one of them calls refreshData() after a write.
export const createDataSlice: Slice<'loadTeachers' | 'loadStudents' | 'refreshData'> = (set) => ({
  loadTeachers: (t) => set({ teachers: t }),
  loadStudents: (s) => set((prev) => ({ students: s, attClass: prev.attClass || (s.length ? s[0].klass : '') })),
  refreshData: async () => { await runRefresh() },
})
