import type { Slice } from '../slice'

// SupabaseProvider owns the full-dataset fetch (it owns the row mappers) and
// registers it here on mount, so a store action can re-pull fresh data after a
// mutation - marking attendance, say - instead of waiting for a focus or a
// refresh. Every domain slice calls refreshData() after a write, which is why
// this sits apart from them rather than inside one.
let refresh: (() => Promise<void>) | null = null

export const registerRefresh = (fn: () => Promise<void>) => { refresh = fn }

export const createDataSlice: Slice<'loadTeachers' | 'loadStudents' | 'refreshData'> = (set) => ({
  loadTeachers: (t) => set({ teachers: t }),
  loadStudents: (s) => set((prev) => ({ students: s, attClass: prev.attClass || (s.length ? s[0].klass : '') })),
  refreshData: async () => { await refresh?.() },
})
