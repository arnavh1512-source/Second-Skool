// What a support report is made of.
//
// Four questions instead of a message box. "Attendance not working" is not
// something you can act on; "I was marking attendance for Class 10 / the save
// button does nothing / Attendance / every time" is answerable without a single
// follow-up. The first answer doubles as the ticket's title, which is why there
// is no subject field.

// The features in the words a teacher would use, not screen names. The last
// entry matters as much as the rest: without a way out, someone whose problem
// does not fit picks one at random and the answer becomes noise.
export const AREAS = [
  'Attendance', 'Fees', 'Results & tests', 'Timetable', 'Students',
  'Assignments', 'Study material', 'Reminders & notifications',
  'Signing in', 'Something else',
] as const

export type Frequency = 'always' | 'sometimes' | 'first'

// One tap, and the single best signal for telling a real defect from a fluke.
export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'always', label: 'Every time' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'first', label: 'First time' },
]

export type ReportDraft = {
  intent: string
  outcome: string
  area: string
  frequency: Frequency
}

// Mirrors the bounds in supabase/migrations/0023_support_tickets.sql. The
// database is the gate that matters; this exists so the reporter reads a
// sentence instead of a Postgres exception.
export function validateReport(d: ReportDraft): string | null {
  const intent = d.intent.trim()
  if (intent.length < 3 || intent.length > 120) return 'Tell us what you were trying to do'
  const outcome = d.outcome.trim()
  if (outcome.length < 3 || outcome.length > 1000) return 'Tell us what happened instead'
  const area = d.area.trim()
  if (!area || area.length > 40) return 'Choose which part of the app'
  if (!FREQUENCIES.some(f => f.value === d.frequency)) return 'Tell us how often it happens'
  return null
}

// Deliberately four fields. The screen is always `support` by the time a report
// is filed, the URL never changes in a single-route app, and the role is
// already on the ticket — recording those would look like telemetry and tell
// you nothing. These four all actually vary between one reporter and the next.
type Diagnostics = {
  version: string
  viewport: string
  userAgent: string
  lastError: string | null
}

type DiagnosticsInput = {
  version: string
  userAgent: string
  width: number
  height: number
  lastError: string | null
}

export function buildDiagnostics(i: DiagnosticsInput): Diagnostics {
  return {
    version: i.version,
    viewport: `${i.width}x${i.height}`,
    userAgent: i.userAgent.slice(0, 200),
    lastError: i.lastError ? i.lastError.slice(0, 300) : null,
  }
}
