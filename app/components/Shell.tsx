'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useDashboard, type Screen, type Tab } from '../store'
import { Icon } from './Icon'

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    // Mobile: fills the screen (no bezel). md+: framed phone mockup.
    <div className="min-h-[var(--app-h)] w-full flex md:items-center md:justify-center md:bg-td-line md:p-10">
      <div className="w-full flex md:max-w-[402px] md:bg-[#0b0d12] md:rounded-[56px] md:p-[13px] md:shadow-[0_40px_90px_-20px_rgba(20,30,60,.45)]">
        <div className="relative w-full app-frame md:aspect-[376/812] bg-td-bg md:rounded-[44px] overflow-hidden flex flex-col">
          <StatusBar />
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide pt-[env(safe-area-inset-top)] md:pt-0">{children}</div>
          <BottomTabBar />
          <Toast />
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    // Fake status bar is only for the desktop mockup; real phones have their own.
    <div className="hidden md:flex h-12 shrink-0 items-end justify-between px-7 pb-1.5 text-sm font-bold text-td-dark z-5">
      <span>9:41</span>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 w-[118px] h-[30px] bg-[#0b0d12] rounded-[18px]" />
      <div className="flex items-center gap-1.5">
        <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="7" width="3" height="5" rx="1" fill="var(--color-td-dark)"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="var(--color-td-dark)"/><rect x="9" y="2" width="3" height="10" rx="1" fill="var(--color-td-dark)"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="var(--color-td-dark)"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="var(--color-td-dark)" opacity="0.4"/><rect x="2.5" y="2.5" width="16" height="8" rx="1.5" fill="var(--color-td-dark)"/><rect x="24" y="4" width="2" height="5" rx="1" fill="var(--color-td-dark)" opacity="0.4"/></svg>
      </div>
    </div>
  )
}

function BottomTabBar() {
  const { role, tab, go, currentStudentDbId, staffStatus, supabaseUserId, pendingStudents, staffList } = useDashboard()
  if (!role) return null
  // Unapproved Google staff (register/pending/denied) get no navigation.
  if (supabaseUserId && staffStatus !== 'approved') return null

  if (role === 'student') {
    if (!currentStudentDbId) return null
    const color = (t: Tab) => tab === t ? 'var(--color-td-primary)' : 'var(--color-td-subtle)'
    const stuTabs: { key: Tab; label: string; screen: Screen; icon: (c: string) => React.ReactNode }[] = [
      { key: 'stuHome', label: 'Home', screen: 'stuHome', icon: (c) => <Icon name="home" size={23} color={c} /> },
      { key: 'stuResults', label: 'Results', screen: 'stuResults', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V9"/><path d="M12 21V4"/><path d="M19 21v-7"/></svg> },
      { key: 'stuRanking', label: 'Ranking', screen: 'stuRanking', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg> },
      { key: 'stuTeachers', label: 'Teachers', screen: 'stuTeachers', icon: (c) => <Icon name="students" size={23} color={c} /> },
      { key: 'stuProfile', label: 'Profile', screen: 'stuProfile', icon: (c) => <Icon name="person" size={23} color={c} /> },
    ]
    return (
      <div className="shrink-0 flex justify-around items-center pt-3 px-2.5 bg-td-card border-t border-td-line pb-[max(env(safe-area-inset-bottom),16px)] md:pb-[26px]">
        {stuTabs.map(t => (
          <button key={t.key} onClick={() => go(t.screen, t.key)} className="td-plain cursor-pointer flex flex-col items-center gap-[5px] px-2.5 py-1">
            {t.icon(color(t.key))}
            <span className="text-[12px] font-bold" style={{ color: color(t.key) }}>{t.label}</span>
          </button>
        ))}
      </div>
    )
  }

  const color = (t: Tab) => tab === t ? 'var(--color-td-primary)' : 'var(--color-td-subtle)'
  const allTabs: { key: Tab; label: string; headOnly?: boolean; icon: (c: string) => React.ReactNode }[] = [
    { key: 'home', label: 'Home', icon: (c) => <Icon name="home" size={23} color={c} /> },
    { key: 'timetable', label: 'Timetable', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg> },
    { key: 'students', label: 'Students', icon: (c) => <Icon name="students" size={23} color={c} /> },
    { key: 'teachers', label: 'Staff', headOnly: true, icon: (c) => <Icon name="person" size={23} color={c} /> },
    { key: 'more', label: 'More', icon: (c) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg> },
  ]
  const tabs = allTabs.filter(t => role === 'admin' || !t.headOnly)

  // Red dot on "More": something in that section needs the head/teacher's action —
  // a student self-registration waiting, or (head only) a staff access request.
  const pendingStaff = role === 'admin' ? staffList.filter(s => s.status === 'pending').length : 0
  const moreAlert = pendingStudents.length > 0 || pendingStaff > 0

  return (
    <div className="shrink-0 flex justify-around items-center pt-3 pb-[26px] px-2.5 bg-td-card border-t border-td-line">
      {tabs.map(t => (
        <button key={t.key} onClick={() => go(t.key === 'timetable' ? 'timetable' : t.key as Screen, t.key)} className="td-plain cursor-pointer flex flex-col items-center gap-[5px] px-2.5 py-1">
          <span className="relative">
            {t.icon(color(t.key))}
            {t.key === 'more' && moreAlert && (
              <span className="absolute -top-0.5 -right-1 w-[9px] h-[9px] rounded-full bg-td-red border-2 border-td-card" />
            )}
          </span>
          <span className="text-[12px] font-bold" style={{ color: color(t.key) }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

// Every validation message and every write failure in the app arrives here
// ("Enter your full name", "No internet — attendance has NOT been saved").
// Two things were wrong with the single style it used to have:
//
//   1. A failure looked exactly like a success. Same dark pill, same weight,
//      no icon — so a message saying the save did not happen read, at a glance,
//      like the ones saying it did.
//   2. Everything vanished after 2.6s. Long enough to notice a confirmation,
//      nowhere near long enough to read a sentence explaining what went wrong
//      and what to do about it. Errors now hold for 9s (see nav.ts) and can be
//      dismissed by tapping, so neither number has to be a compromise.
//
// The red is #8f2417 rather than the brand td-red (#e8553c): white on td-red
// is about 3:1, which fails WCAG AA for body text, and this is the one surface
// where the text absolutely must be readable.
function Toast() {
  const toast = useDashboard(s => s.toast)
  const kind = useDashboard(s => s.toastKind)
  const dismissToast = useDashboard(s => s.dismissToast)
  if (!toast) return null
  const err = kind === 'error'
  return (
    <div
      role={err ? 'alert' : 'status'}
      aria-live={err ? 'assertive' : 'polite'}
      className={`absolute left-5 right-5 bottom-[104px] rounded-[14px] text-white z-30 shadow-[0_14px_36px_rgba(0,0,0,.28)] animate-[toastIn_.25s_ease] ${err ? 'bg-[#8f2417]' : 'bg-td-ink'}`}
    >
      <button
        type="button"
        onClick={dismissToast}
        aria-label="Dismiss message"
        className={`w-full flex items-start gap-2.5 py-3.5 px-4 cursor-pointer ${err ? 'text-left' : 'justify-center text-center'}`}
      >
        {err && (
          <Icon name="info" size={17} className="shrink-0 mt-px" />
        )}
        <span className="text-[13.5px] font-semibold leading-snug">{toast}</span>
      </button>
    </div>
  )
}

// A blank screen with "No students added yet" on it is a dead end. A head who
// has just created her centre lands on Attendance, Fees or Results and is told
// nothing is there — but not that students live on a different screen, or how
// to get to it. She has to guess, and the guess is the moment she puts the
// phone down. Every empty state that has an obvious next step now carries the
// button for it.
// The WhatsApp mark, in the one place it is defined. It was pasted into
// four screens as a literal path; every copy was the same 900 characters.
export function WhatsAppIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
}

export function EmptyState({ title, hint, actionLabel, onAction }: {
  title: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="text-center td-card rounded-[16px] py-9 px-6">
      <div className="text-[15px] td-strong mb-1.5">{title}</div>
      {hint && <p className="text-[13px] text-td-muted leading-relaxed max-w-[290px] mx-auto mb-0">{hint}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="td-pill mt-4 text-[13.5px] font-extrabold px-5 py-2.5 rounded-[12px] cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer shrink-0">
      <Icon name="back" size={18} color="var(--color-td-dark)" />
    </button>
  )
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-[18px]">
      <div className="flex items-center gap-3.5">
        <BackButton onClick={onBack} />
        <div className="text-xl td-strong">{title}</div>
      </div>
      {right}
    </div>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".35" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// The 800ms lock was a double-tap guard, not a busy state, and the difference
// matters on the connections these teachers actually have. Saving attendance
// for a class of forty over a weak 3G link takes seconds; for all of them the
// button sat there looking idle and tappable, then quietly unlocked itself
// before the write had even landed. Nothing on screen said the save was in
// flight, so the honest reading of the screen was "nothing happened" — and the
// second tap was the reasonable response to that.
//
// So the lock now follows the real work: if the handler returns a promise the
// button stays disabled and spinning until it settles, whether it settles in
// 200ms or twelve seconds. Handlers that are genuinely synchronous keep the
// old timer, which is the right guard for them.
export function PrimaryButton({ onClick, children }: { onClick: () => unknown; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)

  const guard = useCallback(() => {
    if (locked.current) return
    locked.current = true
    const release = () => { locked.current = false; setBusy(false) }

    let result: unknown
    try {
      result = onClick()
    } catch (e) {
      // A handler that throws synchronously must not leave the button dead.
      release()
      throw e
    }

    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setBusy(true)
      void (result as Promise<unknown>).finally(release)
    } else {
      setTimeout(release, 800)
    }
  }, [onClick])

  return (
    <button
      onClick={guard}
      disabled={busy}
      aria-busy={busy}
      className="td-pill w-full text-[15px] font-extrabold py-[15px] rounded-2xl cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-default"
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

// Destructive actions used to ask with window.confirm. It is the wrong tool
// here for a reason that has nothing to do with looks: in an installed PWA and
// in the in-app browsers people open links from, native confirms are throttled,
// suppressed outright, or auto-dismissed — so the guard either blocks the head
// for no reason or waves the action through without her ever seeing a question.
// This dialog is part of the app, so it always appears, always says what will
// happen, and can actually be tested.
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; body: string; confirmLabel: string
  onConfirm: () => void; onCancel: () => void
}) {
  // Escape cancels, and focus lands on the dialog rather than staying behind it.
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] bg-[rgba(16,24,40,.55)] flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[380px] bg-td-card rounded-[20px] p-[21px] outline-none shadow-[0_20px_50px_rgba(16,24,40,.3)] animate-[pop_.2s_ease]"
      >
        <div id="confirm-title" className="text-[16px] td-strong mb-2">{title}</div>
        <div id="confirm-body" className="text-[13.5px] text-td-muted font-semibold leading-snug mb-[18px]">{body}</div>
        <div className="flex gap-2.5">
          <button onClick={onCancel} className="flex-1 border border-td-border bg-td-card text-td-text text-sm font-extrabold py-3 rounded-[14px] cursor-pointer">Cancel</button>
          <button onClick={onConfirm} className="flex-1 border-none bg-td-red text-white text-sm font-extrabold py-3 rounded-[14px] cursor-pointer">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

/**
 * The dashed card holding a code someone is meant to pass on - a join code, a
 * student's link code. Four screens drew one by hand; they agree on everything
 * but the corner radius and the room around them, so those come in on
 * className. Anything below the code itself is children.
 */
export function CodeCard({ label, code, hint, onCopy, className = '', children }: {
  label: React.ReactNode
  code: string
  hint?: string
  onCopy: () => void
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`w-full border-2 border-dashed border-td-primary bg-td-tint-blue p-3.5 ${className}`}>
      <button onClick={onCopy} className="w-full text-left cursor-pointer flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-bold text-td-muted">{label}</div>
          <div className="text-[20px] font-extrabold text-td-primary tracking-[0.15em] truncate">{code}</div>
          {hint && <div className="text-[12px] text-td-muted mt-0.5">{hint}</div>}
        </div>
        <div className="text-[12px] font-bold text-td-primary flex items-center gap-1 shrink-0">
          <Icon name="copy" size={14} color="var(--color-td-primary)" />
          Copy
        </div>
      </button>
      {children}
    </div>
  )
}

export function ChevronRight() {
  return <Icon name="next" size={18} color="var(--color-td-faint)" />
}

/**
 * A select's options - or, when there is nothing to choose from yet, the one
 * line telling the head what to go and add. Six selects wrote this same ternary
 * out by hand.
 */
export function options(names: string[], nothingYet: string) {
  return names.length
    ? names.map(n => <option key={n}>{n}</option>)
    : <option value="">{nothingYet}</option>
}

/** Every class that currently has a student in it, in the order they appear. */
export const classesOf = (students: { klass: string }[]): string[] =>
  [...new Set(students.map(s => s.klass))].filter(Boolean)
