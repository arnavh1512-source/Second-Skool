'use client'

import { useEffect, useState } from 'react'
import { useDashboard } from '../store'
import { queuedMarkCount } from '../lib/att-queue'

// The store seeded `online` from navigator.onLine once, at startup, and then
// nothing ever updated it. A teacher whose signal dropped mid-session still
// carried online:true, so every write guard waved her through and the app told
// her the work was saved. These two events are the only signal the browser
// offers, so this is what keeps that flag honest.
//
// navigator.onLine is not proof of reachability — it reports that a network
// interface exists, which on Indian mobile data is regularly true while nothing
// actually gets through. So it is used only to catch the definitely-offline
// case early, before a round-trip that will never come back. A write that
// fails despite it still lands on friendlyError's offline wording.
export function ConnectionStatus() {
  const online = useDashboard(s => s.online)
  const setOnline = useDashboard(s => s.setOnline)
  const refreshData = useDashboard(s => s.refreshData)
  const role = useDashboard(s => s.role)
  const syncAttQueue = useDashboard(s => s.syncAttQueue)
  const waiting = useDashboard(s => queuedMarkCount(s.attQueue))
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const up = () => {
      setOnline(true)
      setRestored(true)
      // Whatever else changed while she was offline, the screen in front of her
      // is now stale — another teacher may have marked the same class. Pulling
      // on reconnect is cheaper than letting her act on old numbers.
      if (useDashboard.getState().role) void refreshData()
      // And whatever she marked while she was offline is still only on the
      // phone. This is the moment it stops being at the mercy of a reinstall.
      void syncAttQueue()
    }
    const down = () => { setOnline(false); setRestored(false) }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    // Covers a drop that happened before this mounted (or before hydration).
    setOnline(navigator.onLine)
    // The first call is also what loads the queue off the phone at all — the
    // store starts empty so the server render and the first client render
    // agree, and this is the client-only moment that can safely disagree.
    void syncAttQueue()
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [setOnline, refreshData, syncAttQueue])

  useEffect(() => {
    if (!restored) return
    const t = setTimeout(() => setRestored(false), 3200)
    return () => clearTimeout(t)
  }, [restored])

  if (!role) return null

  // These three keep their literal colours rather than td-* tokens: they are
  // white on a dark ground in both themes by design, and a banner that has to
  // be read at a glance is the one place a theme swap must not reach.
  //
  // Deliberately at the very top and unmissable: the whole point is that she
  // finds out before she spends five minutes on a form that cannot be saved.
  // assertive, because a polite live region would wait for her to stop
  // interacting — which is exactly when she is typing into a doomed form.
  //
  // Attendance is now the exception, so the wording no longer claims nothing
  // can be saved. It used to, and it was true, and that was the bug.
  if (!online) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-[70] bg-[#8f2417] text-white text-[13px] font-bold text-center py-2 px-4 pt-[calc(env(safe-area-inset-top)+8px)] shadow-[0_2px_12px_rgba(0,0,0,.2)]"
      >
        No internet — only attendance can be saved right now
      </div>
    )
  }

  // Online, but the phone is still carrying marks. Counted in marks rather than
  // registers because the number has to mean something to her: it is the size
  // of what a reinstall would take with it.
  if (waiting) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[70] bg-[#8a5a08] text-white text-[13px] font-bold text-center py-2 px-4 pt-[calc(env(safe-area-inset-top)+8px)] shadow-[0_2px_12px_rgba(0,0,0,.2)]"
      >
        {waiting} attendance {waiting === 1 ? 'mark' : 'marks'} saved on this phone, syncing…
      </div>
    )
  }

  if (restored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-[70] bg-[#1c6b45] text-white text-[13px] font-bold text-center py-2 px-4 pt-[calc(env(safe-area-inset-top)+8px)] shadow-[0_2px_12px_rgba(0,0,0,.2)]"
      >
        Back online
      </div>
    )
  }

  return null
}
