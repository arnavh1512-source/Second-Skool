import { supabase } from '../../lib/supabase'
import { logError } from '../../lib/log'
import { friendlyError } from '../errors'
import type { Slice } from '../slice'
import type { StudentReport, TeacherActivity, WeeklyReport } from '../types'

type Keys = 'loadWeeklyReport' | 'loadStudentReports' | 'loadTeacherActivity'

export const createReportsSlice: Slice<Keys> = (set, get) => ({
  loadWeeklyReport: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_branch_report', { p_days: days })
    if (error) { logError('report.weekly_failed', { message: error.message }); get().notify(friendlyError(error, 'load the report'), 'error'); return }
    set({ weeklyReport: data as WeeklyReport })
  },

  loadStudentReports: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_student_reports', { p_days: days })
    if (error) { logError('report.students_failed', { message: error.message }); get().notify(friendlyError(error, 'load the reports'), 'error'); return }
    set({ studentReports: (data ?? []) as StudentReport[] })
  },

  loadTeacherActivity: async (days = 7) => {
    const { data, error } = await supabase.rpc('weekly_teacher_activity', { p_days: days })
    if (error) { logError('report.activity_failed', { message: error.message }); get().notify(friendlyError(error, 'load the activity'), 'error'); return }
    set({ teacherActivity: (data ?? []) as TeacherActivity[] })
  },
})
