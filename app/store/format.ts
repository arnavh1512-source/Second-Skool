// Pure display helpers. No store, no Supabase — safe to import anywhere.

export const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
// Avatar backgrounds, always under white initials — the same eight colours in
// either theme, so these stay literal rather than following the tokens.
const COLORS = ['#2a6fdb','#7c5cdb','#2fa36b','#e0962f','#d94f8a','#3aa0c4','#c4683a','#5a93ef']
export const GRADIENTS = ['linear-gradient(135deg,#2a6fdb,#5a93ef)','linear-gradient(135deg,#7c5cdb,#a487ef)','linear-gradient(135deg,#2fa36b,#56c48d)','linear-gradient(135deg,#e0962f,#efb45a)','linear-gradient(135deg,#d94f8a,#ec7cae)','linear-gradient(135deg,#3aa0c4,#62bcd8)']
export const av = (i: number) => COLORS[i % COLORS.length]
export const feeColor = (s: string) => s === 'Paid' ? { c: 'var(--color-td-green)', b: 'var(--color-td-tint-green)' } : s === 'Due' ? { c: 'var(--color-td-amber)', b: 'var(--color-td-tint-amber)' } : { c: 'var(--color-td-red)', b: 'var(--color-td-tint-red)' }
export const stuGrade = (pct: number) => pct >= 90 ? { g: 'A+', c: 'var(--color-td-green)', t: 'var(--color-td-tint-green)' } : pct >= 80 ? { g: 'A', c: 'var(--color-td-primary)', t: 'var(--color-td-tint-blue)' } : pct >= 70 ? { g: 'B', c: 'var(--color-td-amber)', t: 'var(--color-td-tint-amber)' } : { g: 'C', c: 'var(--color-td-red)', t: 'var(--color-td-tint-red)' }

// Every date the app renders comes out of Postgres or off a device clock, and
// a malformed or missing one used to reach the screen as the literal string
// "Invalid Date" (or "NaNm ago"). One parser decides what unparseable looks
// like, and it looks like nothing at all.
export const safeDate = (v: string | number | null | undefined): Date | null => {
  if (v === null || v === undefined || v === '') return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function timeAgo(dateStr: string): string {
  const parsed = safeDate(dateStr)
  if (!parsed) return ''
  const mins = Math.floor((Date.now() - parsed.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export const fmtDate = (d: string | number | null | undefined) =>
  safeDate(d)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ?? ''

// Same, without the year — for labels that sit next to a relative time.
export const fmtDayMonth = (d: string | number | null | undefined) =>
  safeDate(d)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) ?? ''
export const rupee = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

// `YYYY-MM-DD` for the Postgres `date` columns, in the device's own timezone.
//
// Deliberately not toISOString(), which is UTC: the UTC day rolls at 05:30 IST,
// so an early-morning class marked in India was filed under the previous date.
// A teacher means "today" in the room they are standing in, so the business
// date is the local one. One spelling, so the call sites can never drift.
export const isoDay = (d: Date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The inverse of isoDay, and it exists for the same reason isoDay does not use
// toISOString(). `new Date('2026-08-30')` is parsed by the spec as UTC
// midnight, but every reader here — isoDay, getDate(), toLocaleString — asks
// for *local* components. West of UTC those disagree by a day: a head in
// London picking 30 August stored 30 August and saw it back as 29 August, and
// one in New York had a meeting quietly moved to the evening before.
// Splitting the string keeps the day the user picked the day everyone sees.
// Date-only columns only (meetings.date, assignments.due_date, fees.due_date).
// For a timestamptz, safeDate is still the right call.
export const parseDay = (v: string | null | undefined): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '')
  if (!m) return safeDate(v)
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}
