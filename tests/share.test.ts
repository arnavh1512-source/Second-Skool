import { describe, it, expect } from 'vitest'
import { studentCodeMessage, absenceCheckInMessage, whatsappShareUrl, appOrigin, weeklyReportMessage, studentReportMessage } from '../app/lib/share'

describe('appOrigin', () => {
  it('falls back to the production URL when there is no window (SSR)', () => {
    expect(appOrigin()).toBe('https://tution-management-taupe.vercel.app')
  })
})

describe('studentCodeMessage', () => {
  it('includes the student name, the code, and the app link', () => {
    const msg = studentCodeMessage('Arjun', 'TUT-ABCDEFGH')
    expect(msg).toContain('Arjun')
    expect(msg).toContain('TUT-ABCDEFGH')
    expect(msg).toContain('tution-management-taupe.vercel.app')
  })

  it('uses a friendly fallback when the name is blank', () => {
    expect(studentCodeMessage('   ', 'TUT-ABCDEFGH')).toContain('your child')
  })
})

describe('absenceCheckInMessage', () => {
  it('names the child, the count and the centre', () => {
    const msg = absenceCheckInMessage('Arjun', 4, 'Sharma Classes')
    expect(msg).toContain('Arjun')
    expect(msg).toContain('4 classes')
    expect(msg).toContain('Sharma Classes')
  })

  it('asks rather than accuses', () => {
    // The one phrasing that ends the conversation is the one that reads as a
    // complaint, and at this point the centre does not know what happened.
    expect(absenceCheckInMessage('Arjun', 3)).toContain('Is everything alright')
  })

  it('falls back when the name or the centre name is blank', () => {
    const msg = absenceCheckInMessage('  ', 3, '   ')
    expect(msg).toContain('your child')
    expect(msg).toContain('the centre')
  })
})

describe('whatsappShareUrl', () => {
  it('prefixes a bare 10-digit Indian number with 91', () => {
    expect(whatsappShareUrl('9876543210', 'hi')).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
  })

  it('strips spaces, dashes and plus signs', () => {
    expect(whatsappShareUrl('+91 98765-43210', 'hi')).toContain('wa.me/919876543210')
  })

  it('keeps an already-international number as-is', () => {
    expect(whatsappShareUrl('919876543210', 'hi')).toContain('wa.me/919876543210')
  })

  it('url-encodes the message', () => {
    expect(whatsappShareUrl('9876543210', 'a b&c')).toContain('text=a%20b%26c')
  })

  it('yields the contact-picker form when the number is empty', () => {
    expect(whatsappShareUrl('', 'hi')).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})

describe('weeklyReportMessage', () => {
  const report = {
    generated_at: '2026-06-30T00:00:00Z',
    branches: [
      { name: 'Noida Central', students: 12, new_students: 2, staff: 3, att_pct: 88, fees_collected: 50000, fees_pending: 15000 },
      { name: 'Sector 18', students: 5, new_students: 0, staff: 1, att_pct: 0, fees_collected: 0, fees_pending: 0 },
    ],
    unassigned_students: 1,
    tests_this_week: 4,
  }

  it('includes each branch name and its key numbers', () => {
    const msg = weeklyReportMessage(report)
    expect(msg).toContain('Noida Central')
    expect(msg).toContain('Sector 18')
    expect(msg).toContain('88%')
    expect(msg).toContain('₹50,000')
    expect(msg).toContain('+2 new')
  })

  it('shows centre totals (unassigned + tests)', () => {
    const msg = weeklyReportMessage(report)
    expect(msg).toContain('Unassigned students: 1')
    expect(msg).toContain('Tests conducted this week: 4')
  })

  it('handles a centre with no branches', () => {
    const msg = weeklyReportMessage({ generated_at: '2026-06-30T00:00:00Z', branches: [], unassigned_students: 0, tests_this_week: 0 })
    expect(msg).toContain('No branches configured yet')
  })
})

describe('studentReportMessage', () => {
  it('computes attendance % and includes name, tests and fees', () => {
    const msg = studentReportMessage({ name: 'Arjun', klass: 'Class 10-B', parent: '', fee_status: 'Due', att_present: 4, att_total: 5, tests: 2, avg_pct: 82 })
    expect(msg).toContain('Arjun')
    expect(msg).toContain('80% (4/5)')
    expect(msg).toContain('2 (avg 82%)')
    expect(msg).toContain('Fees: Due')
  })

  it('reports when no classes were marked this week', () => {
    const msg = studentReportMessage({ name: 'Neha', klass: 'Class 9', parent: '', fee_status: 'Paid', att_present: 0, att_total: 0, tests: 0, avg_pct: 0 })
    expect(msg).toContain('no classes marked this week')
  })

  it('switches wording to monthly when days=30', () => {
    const msg = studentReportMessage({ name: 'Neha', klass: 'Class 9', parent: '', fee_status: 'Paid', att_present: 20, att_total: 24, tests: 3, avg_pct: 75 }, 'My Centre', 30)
    expect(msg).toContain('Monthly update')
    expect(msg).toContain('Tests this month')
    expect(msg).toContain('My Centre')
  })
})
