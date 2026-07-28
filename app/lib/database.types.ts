export type Role = 'admin' | 'teacher' | 'student'
export type FeeStatus = 'Paid' | 'Due' | 'Overdue'
export type AttendanceStatus = 'Present' | 'Absent' | 'Leave'
export type ReminderType = 'Test' | 'Absence' | 'Fee' | 'Homework'
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat'
export type PlanType = 'Monthly' | 'Half-yearly' | 'Yearly'
export type SubStatus = 'active' | 'cancelled' | 'expired'

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  address: string | null
  is_main: boolean
  created_at: string
}

export interface Teacher {
  id: string
  profile_id: string | null
  name: string
  subject: string
  experience: number
  qualification: string | null
  rating: number | null
  about: string | null
  branch_id: string | null
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  profile_id: string | null
  student_code: string
  name: string
  class: string
  school: string | null
  parent_contact: string | null
  address: string | null
  fee_status: FeeStatus
  branch_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  student_id: string
  date: string
  status: AttendanceStatus
  marked_by: string | null
  created_at: string
}

export interface Subject {
  id: string
  name: string
  created_at: string
}

export interface Test {
  id: string
  name: string
  subject_id: string
  class: string
  max_marks: number
  date: string
  created_by: string | null
  created_at: string
}

export interface Result {
  id: string
  test_id: string
  student_id: string
  marks: number
  created_at: string
}

export interface Assignment {
  id: string
  title: string
  subject_id: string | null
  class: string
  due_date: string
  instructions: string | null
  created_by: string | null
  created_at: string
}

export interface Fee {
  id: string
  student_id: string
  amount: number
  period: string
  due_date: string
  paid_date: string | null
  status: FeeStatus
  created_at: string
}

export interface Meeting {
  id: string
  title: string
  meeting_type: string | null
  date: string
  time: string | null
  description: string | null
  created_by: string | null
  branch_id: string | null
  created_at: string
}

export interface Reminder {
  id: string
  type: ReminderType
  message: string
  target_class: string | null
  sent_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  student_id: string
  title: string
  detail: string | null
  icon: string
  read: boolean
  created_at: string
}

export interface TimetableEntry {
  id: string
  day: Day
  start_time: string
  end_time: string
  subject: string
  class: string
  room: string | null
  teacher_id: string | null
  branch_id: string | null
  created_at: string
}

export interface Subscription {
  id: string
  branch_id: string
  plan: PlanType
  price: number
  starts_at: string
  renews_at: string
  status: SubStatus
  created_at: string
}

