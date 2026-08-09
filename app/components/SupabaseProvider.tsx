'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useDashboard, registerRefresh, type Role, type StaffStatus, type Teacher, type Student, type PendingStudent, type FeeStatus, type MeetingItem, type AssignmentItem, type BranchItem, type StuResultItem, type AttLogItem, type NotifItem, type FeeHistoryItem, type ScheduleItem } from '../store'

// Minimal shape of the Supabase rows this provider reads — the DB schema is the
// source of truth, and existing `??` fallbacks handle nullable columns.
type Row = {
  [key: string]: unknown
  id: string; name: string; address: string; is_main: boolean; branch_id: string
  date: string; title: string; time: string; meeting_type: string
  due_date: string; class: string
  day: string; start_time: string; end_time: string; subject: string; room: string
  test_id: string; subject_id: string; max_marks: number; marks: number
  student_id: string; status: string
  period: string; paid_date: string; amount: number
  icon: string; tint: string; detail: string; created_at: string
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const { setAuth, loadTeachers, loadStudents, set } = useDashboard()
  const lastRefresh = useRef(0)
  const role = useDashboard(s => s.role)
  const staffStatus = useDashboard(s => s.staffStatus)

  // Register the service worker so the app is installable (Add to Home Screen)
  // and can receive push notifications.
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // Let store mutations request a fresh full-dataset pull (e.g. after saving
  // attendance) — but only for approved staff who actually load that dataset.
  useEffect(() => {
    registerRefresh(async () => {
      const st = useDashboard.getState()
      if (st.supabaseUserId && (st.role === 'admin' || st.role === 'teacher') && st.staffStatus === 'approved') {
        await fetchAllData().catch(() => {})
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- register once; fetchAllData reads fresh state via store actions
  }, [])

  // Head only: keep the pending list warm and alert the instant a teacher
  // requests access (realtime on profiles; RLS limits events to own centre).
  useEffect(() => {
    if (role !== 'admin' || staffStatus !== 'approved') return
    useDashboard.getState().loadStaff()
    const ch = supabase
      .channel('pending-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        const st = useDashboard.getState()
        const row = payload.new as { staff_status?: string; full_name?: string } | null
        const was = (payload.old as { staff_status?: string } | null)?.staff_status
        if (row?.staff_status === 'pending' && was !== 'pending') {
          st.notify(`${row.full_name || 'A teacher'} is requesting access — check Staff access`)
        }
        st.loadStaff()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [role, staffStatus])

  // Staff (head or teacher): alert + refresh the moment a student self-registers,
  // so pending requests surface live. RLS (students_staff) scopes events to the
  // caller's own centre.
  useEffect(() => {
    if ((role !== 'admin' && role !== 'teacher') || staffStatus !== 'approved') return
    const ch = supabase
      .channel('student-requests-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        const st = useDashboard.getState()
        const row = payload.new as { status?: string; name?: string } | null
        const was = (payload.old as { status?: string } | null)?.status
        if (row?.status === 'pending' && was !== 'pending') {
          st.notify(`${row.name || 'A student'} requested to join — check Student requests`)
        }
        st.refreshData()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [role, staffStatus])

  // No Google session: a returning student may have a saved code; otherwise land on login.
  function resumeStudentOrLanding() {
    const code = typeof window !== 'undefined' ? localStorage.getItem('student_code') : null
    if (code) {
      useDashboard.getState().loadStudentByCode(code).then(ok => { if (!ok) set({ authLoading: false }) })
    } else {
      set({ authLoading: false })
    }
  }

  async function handleAuth(userId: string, email: string) {
    // A Google-authenticated user is staff, never a code-access student. Purge
    // any student_code left over from testing so a session blip can't drop this
    // device into the student "invalid code" path.
    if (typeof window !== 'undefined') localStorage.removeItem('student_code')
    try {
      const { data: profile } = await supabase.from('profiles').select('role, staff_status, full_name, phone, subject, qualification, profile_completed_at').eq('id', userId).single()
      const role = (profile?.role as Role) ?? 'student'
      const staffStatus = (profile?.staff_status as StaffStatus) ?? 'none'
      const { data: headExists } = await supabase.rpc('head_exists')
      setAuth(userId, role, email, staffStatus, !!headExists, {
        // Name deliberately starts blank in the setup form even though a
        // Google-derived value exists — the point of the gate is that the
        // teacher states their own details. Carry it anyway so an already
        // completed profile renders correctly everywhere else.
        name: (profile?.full_name as string) ?? '',
        phone: (profile?.phone as string) ?? '',
        subject: (profile?.subject as string) ?? '',
        qualification: (profile?.qualification as string) ?? '',
        done: !!profile?.profile_completed_at,
      })
      // Only approved staff load the centre's full dataset. dataLoading gates the
      // UI so Home never flashes zeros before the first fetch completes.
      if ((role === 'admin' || role === 'teacher') && staffStatus === 'approved') {
        set({ dataLoading: true })
        try { await fetchAllData() }
        catch { useDashboard.getState().notify('Could not load data — check your connection and refresh') }
        finally { set({ dataLoading: false }) }
      }
    } catch {
      // Network/unexpected failure before we resolved the role: never strand the
      // user on the splash spinner — clear loading so the UI can recover.
      set({ authLoading: false, dataLoading: false })
      useDashboard.getState().notify('Connection problem — please refresh')
    }
  }

  async function fetchAllData() {
    const [
      { data: teachers },
      { data: students },
      { data: branches },
      { data: meetings },
      { data: assignments },
      { data: timetable },
      { data: fees },
      { data: tests },
      { data: results },
      { data: notifications },
      { data: subjects },
      { data: attendance },
      { data: batches },
    ] = await Promise.all([
      // Defensive caps: orderings put the newest rows first, so a centre that
      // outgrows a cap loses only the oldest tail, never current data.
      supabase.from('teachers').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('students').select('id,name,class,batch,school,parent_contact,student_code,fee_status,address,branch_id,profile_id,status,created_at').order('created_at', { ascending: false }).limit(2000),
      supabase.from('branches').select('*').order('is_main', { ascending: false }).limit(50),
      supabase.from('meetings').select('*').order('date', { ascending: false }).limit(200),
      supabase.from('assignments').select('*').order('due_date', { ascending: false }).limit(500),
      supabase.from('timetable').select('*').order('start_time', { ascending: true }).limit(1000),
      supabase.from('fees').select('*').order('due_date', { ascending: false }).limit(5000),
      supabase.from('tests').select('*').order('date', { ascending: false }).limit(1000),
      supabase.from('results').select('*').limit(20000),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('subjects').select('*').limit(100),
      supabase.from('attendance').select('*').order('date', { ascending: false }).limit(20000),
      supabase.from('batches').select('*').order('created_at', { ascending: true }).limit(200),
    ])

    const mappedTeachers = (teachers ?? []).map(mapTeacher)
    // Per-student attendance % from the fetched attendance rows (mapStudent
    // alone can't know it — without this every student shows 0%).
    const attByStudent: Record<string, { p: number; t: number }> = {}
    for (const a of (attendance ?? []) as Row[]) {
      const k = a.student_id as string
      if (!attByStudent[k]) attByStudent[k] = { p: 0, t: 0 }
      attByStudent[k].t++
      if (a.status === 'Present') attByStudent[k].p++
    }
    // Self-registered students awaiting approval are held out of the roster (and
    // every count/ranking derived from it) until the head approves them.
    const approvedRows = (students ?? []).filter((s) => ((s.status as string) ?? 'approved') === 'approved')
    const pendingRows = (students ?? []).filter((s) => (s.status as string) === 'pending')
    const branchNameById: Record<string, string> = Object.fromEntries(
      (branches ?? []).map((b: Row) => [b.id as string, b.name as string]),
    )
    // Per-student fee totals: collected = sum of Paid, due = sum of everything else.
    const feeByStudent: Record<string, { collected: number; due: number }> = {}
    for (const f of (fees ?? []) as Row[]) {
      const k = f.student_id as string
      if (!feeByStudent[k]) feeByStudent[k] = { collected: 0, due: 0 }
      const amt = Number(f.amount) || 0
      if (f.status === 'Paid') feeByStudent[k].collected += amt
      else feeByStudent[k].due += amt
    }
    const mappedStudents = approvedRows.map((row) => {
      const st = mapStudent(row)
      const branch = branchNameById[row.branch_id as string]
      const att = attByStudent[st.dbId ?? '']
      const fee = feeByStudent[st.dbId ?? '']
      return {
        ...st,
        ...(branch ? { branch } : {}),
        ...(att && att.t > 0 ? { attendance: Math.round((att.p / att.t) * 100) } : {}),
        ...(fee ? { feeCollected: fee.collected, feeDue: fee.due } : {}),
      }
    })
    const pendingStudents: PendingStudent[] = pendingRows.map((s) => ({
      dbId: s.id as string, name: (s.name as string) ?? '', klass: (s.class as string) ?? '',
      school: (s.school as string) ?? '', parent: (s.parent_contact as string) ?? '',
      address: (s.address as string) ?? '', code: (s.student_code as string) ?? '',
      when: timeAgo(s.created_at as string),
    }))
    const batchList = (batches ?? []).map((b: Row) => ({ name: b.name as string, dbId: b.id as string }))
    const subjectList = (subjects ?? []).map((s: Row) => ({ name: s.name as string, dbId: s.id as string }))
    const subjectMap = Object.fromEntries(subjectList.map(s => [s.dbId, s.name]))
    const studentMap = Object.fromEntries(mappedStudents.map(s => [s.dbId, s]))

    loadTeachers(mappedTeachers)
    loadStudents(mappedStudents)

    // Branches — count per-branch
    const branchesList: BranchItem[] = (branches ?? []).map((b: Row) => ({
      name: b.name, address: b.address ?? '', main: !!b.is_main,
      students: approvedRows.filter((s) => s.branch_id === b.id).length,
      staff: (teachers ?? []).filter((t: Row) => t.branch_id === b.id).length,
      dbId: b.id,
    }))

    // Meetings
    const meetingsList: MeetingItem[] = (meetings ?? []).map((m: Row) => {
      const d = new Date(m.date)
      return {
        day: String(d.getDate()).padStart(2, '0'),
        mon: d.toLocaleString('en', { month: 'short' }),
        title: m.title, time: m.time ?? '', kind: m.meeting_type ?? 'Staff',
        dbId: m.id,
      }
    })

    // Assignments
    const assignmentsList: AssignmentItem[] = (assignments ?? []).map((a: Row) => {
      const d = new Date(a.due_date)
      return {
        title: a.title, klass: a.class ?? '',
        due: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`,
        submitted: 0, total: mappedStudents.filter(s => s.klass === (a.class ?? '')).length,
        dbId: a.id,
      }
    })

    // Timetable grouped by day
    const timetableData: Record<string, string[][]> = {}
    for (const t of (timetable ?? []) as Row[]) {
      const day = t.day as string
      if (!timetableData[day]) timetableData[day] = []
      timetableData[day].push([t.start_time, t.end_time, t.subject ?? '', t.class ?? '', t.room ?? ''])
    }

    // Today's schedule
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const today = days[new Date().getDay()]
    const todayEntries = timetableData[today] ?? []
    const now = new Date()
    const schedule: ScheduleItem[] = todayEntries.map(([start, end, subject, klass, room]) => {
      const [h] = start.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const startH = new Date(); startH.setHours(h, 0, 0, 0)
      const [eh] = end.split(':').map(Number)
      const endH = new Date(); endH.setHours(eh, 0, 0, 0)
      const status = now > endH ? 'Done' : now >= startH ? 'Ongoing' : `${hour12}:00 ${ampm}`
      const statusColor = status === 'Done' ? '#2fa36b' : status === 'Ongoing' ? '#2a6fdb' : '#6b7689'
      const statusBg = status === 'Done' ? '#e7f5ee' : status === 'Ongoing' ? '#eaf1fc' : '#eef1f7'
      return { time: `${hour12}:00`, ampm, subject, klass, room, status, statusColor, statusBg }
    })

    // Subjects
    const subjectItems = subjectList

    // Results + Rankings
    const testMap: Record<string, Row> = Object.fromEntries((tests ?? []).map((t: Row) => [t.id, t]))
    const stuResults: StuResultItem[] = (results ?? []).map((r: Row) => {
      const test = testMap[r.test_id]
      return {
        subject: subjectMap[test?.subject_id] ?? 'Unknown',
        test: test?.name ?? 'Test', date: test?.date ?? '',
        marks: r.marks ?? 0, total: test?.max_marks ?? 100,
      }
    })

    // Compute rankings per subject from results
    const rankData: Record<string, [string, number][]> = {}
    const resultsBySubjectStudent: Record<string, Record<string, { total: number; max: number }>> = {}
    for (const r of (results ?? []) as Row[]) {
      const test = testMap[r.test_id]
      if (!test) continue
      const subjectName = subjectMap[test.subject_id] ?? 'Unknown'
      const student = studentMap[r.student_id]
      const studentName = student?.name ?? 'Unknown'
      if (!resultsBySubjectStudent[subjectName]) resultsBySubjectStudent[subjectName] = {}
      if (!resultsBySubjectStudent[subjectName][studentName]) resultsBySubjectStudent[subjectName][studentName] = { total: 0, max: 0 }
      resultsBySubjectStudent[subjectName][studentName].total += r.marks ?? 0
      resultsBySubjectStudent[subjectName][studentName].max += test.max_marks ?? 100
    }
    for (const [subject, students] of Object.entries(resultsBySubjectStudent)) {
      rankData[subject] = Object.entries(students)
        .map(([name, { total, max }]) => [name, max > 0 ? Math.round((total / max) * 100) : 0] as [string, number])
        .sort((a, b) => b[1] - a[1])
    }

    // Attendance log (for student view)
    const statusIcons: Record<string, { icon: string; tint: string; color: string }> = {
      Present: { icon: '✅', tint: '#e7f5ee', color: '#2fa36b' },
      Absent: { icon: '❌', tint: '#fdecea', color: '#e8553c' },
      Leave: { icon: '📋', tint: '#fcf3e3', color: '#e0962f' },
    }
    const stuAttendanceLog: AttLogItem[] = (attendance ?? []).slice(0, 15).map((a: Row) => {
      const d = new Date(a.date)
      const si = statusIcons[a.status] ?? statusIcons.Present
      return {
        day: d.toLocaleString('en', { weekday: 'long' }),
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: a.status, ...si,
      }
    })

    // Fee history + pending fee (for student view)
    const stuFeeHistory: FeeHistoryItem[] = (fees ?? []).filter((f: Row) => f.status === 'Paid').map((f: Row) => ({
      period: f.period ?? '',
      date: f.paid_date ? new Date(f.paid_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      amount: `₹${(f.amount ?? 0).toLocaleString('en-IN')}`,
    }))
    const pendingFee = (fees ?? []).find((f: Row) => f.status !== 'Paid')
    const stuPendingFee = pendingFee ? {
      amount: `₹${(pendingFee.amount ?? 0).toLocaleString('en-IN')}`,
      period: pendingFee.period ?? '',
      dueDate: pendingFee.due_date ? new Date(pendingFee.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    } : null

    // Notifications (for student view)
    const stuNotifications: NotifItem[] = (notifications ?? []).map((n: Row) => ({
      icon: n.icon ?? '📢', tint: n.tint ?? '#eaf1fc',
      title: n.title ?? '', detail: n.detail ?? '',
      when: timeAgo(n.created_at), dbId: n.id,
    }))

    // Reminders as notifications
    const stuReminders: NotifItem[] = stuNotifications.slice(0, 3)

    set({
      branchesList, meetingsList, assignmentsList, timetableData, schedule,
      rankData, subjects: subjectItems, batches: batchList, stuResults, stuAttendanceLog,
      stuFeeHistory, stuPendingFee, stuNotifications, stuReminders, pendingStudents,
    })
  }

  useEffect(() => {
    // If Google/Supabase rejected the sign-in, the reason comes back in the URL
    // (query OR hash) as ?error=...&error_description=... — surface it instead of
    // silently bouncing the user back to the login screen.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const err = query.get('error_description') || query.get('error') || hash.get('error_description') || hash.get('error')
    if (err) {
      const msg = decodeURIComponent(err).replace(/\+/g, ' ')
      console.error('OAuth callback error:', msg)
      useDashboard.getState().notify(`Sign-in failed: ${msg}`)
      // Clean the URL so a refresh doesn't re-trigger the toast.
      window.history.replaceState({}, '', window.location.pathname)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuth(session.user.id, session.user.email ?? '')
      else resumeStudentOrLanding()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) handleAuth(session.user.id, session.user.email ?? '')
      else resumeStudentOrLanding()
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; auth listener must not rebind per render
  }, [])

  // Pull fresh data for whoever is signed in — approved staff get the full
  // dataset; a code-access student re-pulls their snapshot. Best-effort.
  const refreshCurrentData = () => {
    const st = useDashboard.getState()
    if (st.supabaseUserId && (st.role === 'admin' || st.role === 'teacher') && st.staffStatus === 'approved') {
      fetchAllData().catch(() => {}) // ignore transient failures
    } else if (!st.supabaseUserId && st.currentStudentDbId) {
      const code = localStorage.getItem('student_code')
      if (code) st.loadStudentByCode(code, false) // refresh without navigating
    }
  }

  // Refresh-on-focus: re-pull fresh data whenever the user returns to the app
  // (tab/app regains focus). Throttled so quick tab-switches don't spam queries.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefresh.current < 8000) return
      lastRefresh.current = Date.now()
      refreshCurrentData()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; focus listener reads fresh state via getState()
  }, [])

  // Instant in-app update: the push service worker posts a 'refresh' message the
  // moment a notification arrives, so a reminder appears in-app right away without
  // waiting for a focus change or reload (covers users sitting in the foreground).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'refresh') refreshCurrentData() }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; handler reads fresh state via getState()
  }, [])

  // Foreground poll (students only): a code-access student's snapshot is a single
  // cheap RPC, so re-pull it periodically while the app is visible — the fallback
  // for students who haven't enabled push (they get no service-worker message).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const st = useDashboard.getState()
      if (!st.supabaseUserId && st.currentStudentDbId) {
        const code = localStorage.getItem('student_code')
        if (code) st.loadStudentByCode(code, false)
      }
    }, 60000)
    return () => clearInterval(id)
  }, [])

  return <>{children}</>
}

function mapTeacher(t: Record<string, unknown>): Teacher {
  return {
    name: t.name as string, subject: t.subject as string,
    experience: (t.experience as number) ?? 0, qualification: (t.qualification as string) ?? '—',
    rating: t.rating != null ? String(t.rating) : undefined,
    about: (t.about as string) ?? undefined, dbId: t.id as string,
  }
}

function mapStudent(s: Record<string, unknown>): Student {
  return {
    name: s.name as string, klass: (s.class as string) ?? '',
    attendance: 0, feeStatus: ((s.fee_status as string) ?? 'Due') as FeeStatus,
    school: (s.school as string) ?? '', parent: (s.parent_contact as string) ?? '',
    id: (s.student_code as string) ?? '', address: (s.address as string) ?? '',
    dbId: s.id as string, status: (s.status as string) ?? 'approved',
    batch: (s.batch as string) ?? undefined,
  }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
