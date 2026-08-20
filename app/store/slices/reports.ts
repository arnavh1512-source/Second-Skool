import { supabase } from '../../lib/supabase'
import type { Slice } from '../slice'
import type { StudentReport, TeacherActivity, WeeklyReport } from '../types'

type Keys = 'loadWeeklyReport' | 'loadStudentReports' | 'loadTeacherActivity'

export const createReportsSlice: Slice<Keys> = (set, get) => ({
  loadWeeklyReport: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_branch_report', { p_days: days })
    if (error) { console.error('weekly report failed:', error.message); get().notify(`Could not load report: ${error.message}`); return }
    set({ weeklyReport: data as WeeklyReport })
  },

  loadStudentReports: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_student_reports', { p_days: days })
    if (error) { console.error('student reports failed:', error.message); get().notify(`Could not load reports: ${error.message}`); return }
    set({ studentReports: (data ?? []) as StudentReport[] })
  },

  loadTeacherActivity: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_teacher_activity', { p_days: days })
    if (error) { console.error('teacher activity failed:', error.message); get().notify(`Could not load activity: ${error.message}`); return }
    set({ teacherActivity: (data ?? []) as TeacherActivity[] })
  },
})
