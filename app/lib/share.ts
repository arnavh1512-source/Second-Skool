// Sharing helpers for handing a student their login code.
// Students never sign in with Google — they enter a per-student code — so the
// teacher needs a frictionless way to deliver that code to the parent.

import { fmtDate } from '../store/format'

const FALLBACK_ORIGIN = 'https://tution-management-taupe.vercel.app'

// Prefer the live origin so custom domains / localhost share the right link.
export function appOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : FALLBACK_ORIGIN
}

// The message a parent receives, with the code and exactly how to use it.
export function studentCodeMessage(name: string, code: string): string {
  const who = name.trim() ? name.trim() : 'your child'
  return [
    `Hi! Here is the login code for ${who} at Second Skool.`,
    '',
    `Code: ${code}`,
    '',
    `Open ${appOrigin()} → tap "I'm a student" → enter this code to view attendance, marks, fees and reminders.`,
  ].join('\n')
}

import type { WeeklyReport, StudentReport } from '../store'

const inr = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

// Formats the weekly branch report as a WhatsApp-friendly message (*bold* via
// asterisks, • bullets). Sent by the head to themselves or a co-owner.
export function weeklyReportMessage(r: WeeklyReport, centreName = 'Second Skool', days = 7): string {
  const period = days === 7 ? 'week' : 'month'
  const date = fmtDate(r.generated_at)
  const lines: string[] = [`*${centreName} — ${days === 7 ? 'Weekly' : 'Monthly'} Report*`, `As of ${date}`, '']
  if (r.branches.length === 0) lines.push('No branches configured yet.')
  for (const b of r.branches) {
    lines.push(`*${b.name}*`)
    lines.push(`• Students: ${b.students}${b.new_students ? ` (+${b.new_students} new this ${period})` : ''}`)
    lines.push(`• Staff: ${b.staff}`)
    lines.push(`• Attendance (${days}d): ${b.att_pct}%`)
    lines.push(`• Fees collected (${days}d): ${inr(b.fees_collected)}`)
    lines.push(`• Fees pending: ${inr(b.fees_pending)}`)
    lines.push('')
  }
  if (r.unassigned_students) lines.push(`Unassigned students: ${r.unassigned_students}`)
  lines.push(`Tests conducted this ${period}: ${r.tests_this_week}`)
  return lines.join('\n')
}

// A per-student progress note for the parent's WhatsApp (weekly or monthly).
export function studentReportMessage(s: StudentReport, centreName = 'Second Skool', days = 7): string {
  const period = days === 7 ? 'week' : 'month'
  const attPct = s.att_total > 0 ? Math.round((s.att_present / s.att_total) * 100) : null
  const lines: string[] = [`*${centreName} — ${days === 7 ? 'Weekly' : 'Monthly'} update*`, `*${s.name}* · ${s.klass}`, '']
  lines.push(`• Attendance: ${attPct === null ? `no classes marked this ${period}` : `${attPct}% (${s.att_present}/${s.att_total})`}`)
  lines.push(`• Tests this ${period}: ${s.tests}${s.tests > 0 ? ` (avg ${s.avg_pct}%)` : ''}`)
  lines.push(`• Fees: ${s.fee_status}`)
  lines.push('')
  lines.push('Reply here if you have any questions. Thank you!')
  return lines.join('\n')
}

// Build a wa.me deep link. Strips formatting; assumes India (+91) for bare
// 10-digit numbers. An empty/short number yields a link that opens WhatsApp's
// contact picker so the teacher can still choose a recipient.
export function whatsappShareUrl(phone: string, message: string): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  const intl = digits.length === 10 ? `91${digits}` : digits
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

/**
 * Copy text and tell the user the truth about whether it worked.
 *
 * navigator.clipboard is undefined on any non-secure origin and inside several
 * Android WebViews, and writeText() rejects when the document is not focused.
 * Every call site used to assume both away and toast "Copied!" regardless, so
 * a head who tapped the join code got a confirmation and an empty clipboard.
 */
export function copyText(text: string, notify: (msg: string, kind?: 'info' | 'error') => void, label = 'Copied!'): void {
  if (!text) return
  const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (!clip?.writeText) { notify('Copying is not available here — press and hold to copy', 'error'); return }
  clip.writeText(text).then(
    () => notify(label),
    () => notify('Could not copy — press and hold to copy', 'error'),
  )
}
