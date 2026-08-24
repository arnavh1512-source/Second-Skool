// Pure display helpers. No store, no Supabase — safe to import anywhere.

export const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
export const COLORS = ['#2a6fdb','#7c5cdb','#2fa36b','#e0962f','#d94f8a','#3aa0c4','#c4683a','#5a93ef']
export const GRADIENTS = ['linear-gradient(135deg,#2a6fdb,#5a93ef)','linear-gradient(135deg,#7c5cdb,#a487ef)','linear-gradient(135deg,#2fa36b,#56c48d)','linear-gradient(135deg,#e0962f,#efb45a)','linear-gradient(135deg,#d94f8a,#ec7cae)','linear-gradient(135deg,#3aa0c4,#62bcd8)']
export const av = (i: number) => COLORS[i % COLORS.length]
export const feeColor = (s: string) => s === 'Paid' ? { c: '#2fa36b', b: '#e7f5ee' } : s === 'Due' ? { c: '#e0962f', b: '#fcf3e3' } : { c: '#e8553c', b: '#fdecea' }
export const stuGrade = (pct: number) => pct >= 90 ? { g: 'A+', c: '#2fa36b', t: '#e7f5ee' } : pct >= 80 ? { g: 'A', c: '#2a6fdb', t: '#eaf1fc' } : pct >= 70 ? { g: 'B', c: '#e0962f', t: '#fcf3e3' } : { g: 'C', c: '#e8553c', t: '#fdecea' }

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
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
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
