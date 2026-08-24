'use client'

import { useEffect, useState } from 'react'
import { useDashboard, fmtDayMonth } from '../store'

// Every number on these screens is a cached copy. Attendance gets marked by
// whoever is standing in front of the class, fees get collected at the desk,
// and the head reads the totals off a phone that may have been sitting in a
// pocket since the morning. Nothing on screen ever said how old any of it was,
// so a stale figure and a live one looked exactly the same — and the app
// refreshes on focus, which means the moment she looks at it is precisely the
// moment it might still be fetching.
//
// It doubles as the manual pull. There was no way to ask for fresh data short
// of killing the app and reopening it, which is what people actually did.

const MINUTE = 60_000

const label = (at: number | null, now: number) => {
  if (at === null) return 'Not loaded yet'
  const mins = Math.floor((now - at) / MINUTE)
  if (mins < 1) return 'Updated just now'
  if (mins === 1) return 'Updated 1 min ago'
  if (mins < 60) return `Updated ${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return 'Updated 1 hour ago'
  if (hrs < 24) return `Updated ${hrs} hours ago`
  return `Updated ${fmtDayMonth(at)}`
}

export function LastUpdated() {
  const lastSyncedAt = useDashboard(s => s.lastSyncedAt)
  const online = useDashboard(s => s.online)
  const refreshData = useDashboard(s => s.refreshData)
  const [busy, setBusy] = useState(false)

  // Re-render on a timer so "just now" doesn't sit there for an hour telling a
  // comfortable lie. A minute is the smallest unit shown, so a minute is as
  // often as this needs to wake up.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE)
    return () => clearInterval(t)
  }, [])

  const stale = lastSyncedAt !== null && now - lastSyncedAt > 10 * MINUTE

  const pull = async () => {
    if (busy || !online) return
    setBusy(true)
    try { await refreshData() } finally { setBusy(false) }
  }

  return (
    <button
      type="button"
      onClick={pull}
      disabled={busy || !online}
      aria-live="polite"
      aria-label={`${label(lastSyncedAt, now)}. Tap to refresh.`}
      className="inline-flex items-center gap-1.5 bg-transparent border-none p-0 cursor-pointer disabled:cursor-default"
    >
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        stroke={stale ? '#8a6414' : '#6b7689'} strokeWidth="2.4" strokeLinecap="round"
        className={busy ? 'animate-spin' : undefined}
      >
        <path d="M20 12a8 8 0 1 1-2.3-5.6" />
        <path d="M20 4v4.5h-4.5" />
      </svg>
      <span className={`text-[12px] font-semibold ${stale ? 'text-[#8a6414]' : 'text-td-muted'}`}>
        {busy ? 'Refreshing…' : label(lastSyncedAt, now)}
      </span>
    </button>
  )
}
