// Student snapshot mapping (from the get_student_snapshot RPC).
import type { IconName } from '../components/Icon'
import { fmtDate, rupee, timeAgo } from './format'
import type {
  AttLogItem, FeeHistoryItem, FeeStatus, NotifItem, State,
  RankRow, StuAssignmentItem, StuResultItem, Student, Teacher,
} from './types'

const STATUS_ICONS: Record<string, { icon: IconName; tint: string; color: string }> = {
  Present: { icon: 'attendance', tint: 'var(--color-td-tint-green)', color: 'var(--color-td-green)' },
  Absent: { icon: 'absent', tint: 'var(--color-td-tint-red)', color: 'var(--color-td-red)' },
  Leave: { icon: 'leave', tint: 'var(--color-td-tint-amber)', color: 'var(--color-td-amber)' },
}

// Shape of the get_student_snapshot RPC payload — keys mirror the SQL
// json_build_object; nullable columns are handled by the `??` fallbacks below.
// Every key is optional because this one type covers seven different arrays: an
// attendance row carries `date`/`status` and nothing else. Declaring them
// required typechecked a payload the RPC never actually sends.
type SnapRow = {
  [key: string]: unknown
  status?: string | null; date?: string | null; subject?: string | null; test?: string | null
  marks?: number | null; total?: number | null
  period?: string | null; paidDate?: string | null; amount?: number | null; dueDate?: string | null
  icon?: string | null; title?: string | null; detail?: string | null; createdAt?: string | null
  name?: string | null; experience?: number | null; qualification?: string | null
  rating?: number | null; about?: string | null
  day?: string | null; start?: string | null; end?: string | null; room?: string | null; teacher?: string | null
  due?: string | null; instructions?: string | null
}

export type Snapshot = {
  student?: { [key: string]: string | undefined }
  centre?: { name?: string; logo_url?: string }
  attendance?: SnapRow[]; results?: SnapRow[]; fees?: SnapRow[]; notifications?: SnapRow[]
  // Lifetime counts, spanning the archived monthly rollups as well as the
  // daily rows. `attendance` above only ever holds the un-archived days.
  attendanceTotals?: { present?: number | null; total?: number | null }
  teachers?: SnapRow[]; timetable?: SnapRow[]; assignments?: SnapRow[]
  rankings?: Record<string, ([string, number] | { id?: string | null; name?: string; score?: number })[]>
}

export function mapSnapshot(snap: Snapshot): Partial<State> {
  const s = snap.student ?? {}
  const attendance: SnapRow[] = snap.attendance ?? []
  // Counting the daily rows is the fallback, not the answer. Once a centre is
  // three months old archive_old_attendance() has moved everything older than
  // 90 days into attendance_monthly and deleted it from `attendance`, so the
  // daily list is a rolling window — and a percentage computed from it silently
  // became "last 90 days" while the teacher, reading a different query, still
  // saw the lifetime figure. The two numbers described the same child and did
  // not match. attendanceTotals is the lifetime pair; the daily list stays for
  // the day-by-day log, which is all it was ever able to show.
  const totals = snap.attendanceTotals
  const attTotal = totals?.total ?? attendance.length
  const attPresent = totals?.present ?? attendance.filter(a => a.status === 'Present').length
  const attPct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0

  const student: Student = {
    name: s.name ?? '', klass: s.klass ?? '', attendance: attPct, attendanceMarked: attTotal,
    feeStatus: (s.feeStatus ?? 'Due') as FeeStatus, school: s.school ?? '',
    parent: s.parent ?? '', id: s.code ?? '', address: s.address ?? '', dbId: s.dbId,
  }

  const stuAttendanceLog: AttLogItem[] = attendance.slice(0, 15).map((a: SnapRow) => {
    const status = a.status ?? 'Present'
    const d = new Date(a.date ?? '')
    const si = STATUS_ICONS[status] ?? STATUS_ICONS.Present
    return {
      day: isNaN(d.getTime()) ? '' : d.toLocaleString('en', { weekday: 'long' }),
      date: fmtDate(a.date ?? ''), status, ...si,
    }
  })

  const stuResults: StuResultItem[] = (snap.results ?? []).map((r: SnapRow) => ({
    subject: r.subject ?? 'Unknown', test: r.test ?? 'Test', date: r.date ?? '',
    marks: r.marks ?? 0, total: r.total ?? 100,
  }))

  const fees: SnapRow[] = snap.fees ?? []
  const stuFeeHistory: FeeHistoryItem[] = fees.filter(f => f.status === 'Paid').map((f: SnapRow) => ({
    period: f.period ?? '', date: fmtDate(f.paidDate ?? ''), amount: rupee(f.amount ?? 0),
  }))
  const pending = fees.find(f => f.status !== 'Paid')
  const stuPendingFee = pending ? { amount: rupee(pending.amount ?? 0), period: pending.period ?? '', dueDate: fmtDate(pending.dueDate ?? '') } : null

  // dbId here is the creation timestamp, not a row id — the snapshot RPC does
  // not return one. It is an identity for "which notification is this" (the
  // reminder cutoff below parses it back into a date, and the home screen
  // remembers the newest one the student has opened), but it is not unique on
  // its own, so render keys pair it with the row index.
  const stuNotifications: NotifItem[] = (snap.notifications ?? []).map((n: SnapRow) => ({
    icon: n.icon ?? 'notice', tint: 'var(--color-td-tint-blue)', title: n.title ?? '', detail: n.detail ?? '',
    when: timeAgo(n.createdAt ?? ''), dbId: n.createdAt ?? '',
  }))
  // Home surfaces only the last 2 days of notifications so the feed stays short;
  // older ones drop off the home but remain in the bell (stuNotif) history.
  const reminderCutoff = Date.now() - 2 * 86400000
  const stuReminders = stuNotifications
    .filter(n => n.dbId && new Date(n.dbId).getTime() >= reminderCutoff)
    .slice(0, 4)

  const teachers: Teacher[] = (snap.teachers ?? []).map((t: SnapRow) => ({
    name: t.name ?? '', subject: t.subject ?? '', experience: t.experience ?? 0,
    qualification: t.qualification ?? '—',
    rating: t.rating != null ? String(t.rating) : undefined, about: t.about ?? undefined,
  }))

  // Two shapes on the wire: the current RPC returns {id, name, score} objects,
  // and a centre whose database has not had the ranking migration applied yet
  // still returns [name, score] pairs. Both normalise to the same row; the old
  // one simply has no id, and the screens fall back to matching on the name.
  const rankData: Record<string, RankRow[]> = {}
  for (const [subject, rows] of Object.entries(snap.rankings ?? {})) {
    rankData[subject] = (rows ?? []).map(r => Array.isArray(r)
      ? { id: null, name: r[0] ?? '', score: r[1] ?? 0 }
      : { id: r.id ?? null, name: r.name ?? '', score: r.score ?? 0 })
  }

  // Class timetable (head sets it per class; the student sees their class's).
  const timetableData: Record<string, string[][]> = {}
  for (const t of (snap.timetable ?? []) as SnapRow[]) {
    const day = t.day as string
    if (!timetableData[day]) timetableData[day] = []
    timetableData[day].push([t.start ?? '', t.end ?? '', t.subject ?? '', student.klass ?? '', t.room ?? '', t.teacher ?? ''])
  }

  const stuAssignments: StuAssignmentItem[] = (snap.assignments ?? []).map((a: SnapRow) => ({
    title: a.title ?? '', subject: a.subject ?? '', due: fmtDate(a.due ?? ''), instructions: a.instructions ?? '',
  }))

  // Monthly summary (last 30 days) — computed from raw ISO dates before any
  // display formatting, so the student's home card is always current.
  const cutoff = Date.now() - 30 * 86400000
  const monthAtt = attendance.filter((a: SnapRow) => a.date && new Date(a.date).getTime() >= cutoff)
  const monthResults = (snap.results ?? []).filter((r: SnapRow) => r.date && new Date(r.date).getTime() >= cutoff)
  const mMarks = monthResults.reduce((acc: number, r: SnapRow) => acc + (r.marks ?? 0), 0)
  const mTotals = monthResults.reduce((acc: number, r: SnapRow) => acc + (r.total ?? 0), 0)
  const stuMonthly = {
    attPresent: monthAtt.filter((a: SnapRow) => a.status === 'Present').length,
    attTotal: monthAtt.length,
    tests: monthResults.length,
    avgPct: mTotals > 0 ? Math.round((mMarks / mTotals) * 100) : 0,
  }

  return {
    students: [student], currentStudentDbId: student.dbId ?? null,
    centreName: snap.centre?.name ?? '', centreLogo: snap.centre?.logo_url ?? '',
    stuAttendanceLog, stuResults, stuFeeHistory, stuPendingFee,
    stuNotifications, stuReminders,
    teachers, rankData, timetableData, stuAssignments, stuMonthly,
  }
}
