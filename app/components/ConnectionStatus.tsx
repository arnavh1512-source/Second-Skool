'use client'

import { useEffect, useState } from 'react'
import { useDashboard } from '../store'

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
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const up = () => {
      setOnline(true)
      setRestored(true)
      // Whatever else changed while she was offline, the screen in front of her
      // is now stale — another teacher may have marked the same class. Pulling
      // on reconnect is cheaper than letting her act on old numbers.
      if (useDashboard.getState().role) void refreshData()
    }
    const down = () => { setOnline(false); setRestored(false) }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    // Covers a drop that happened before this mounted (or before hydration).
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [setOnline, refreshData])

  useEffect(() => {
    if (!restored) return
    const t = setTimeout(() => setRestored(false), 3200)
    return () => clearTimeout(t)
  }, [restored])

  if (!role) return null

  // Deliberately at the very top and unmissable: the whole point is that she
  // finds out before she spends five minutes marking a register that cannot be
  // saved. assertive, because a polite live region would wait for her to stop
  // interacting — which is exactly when she is typing into a doomed form.
  if (!online) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="fixed top-0 left-0 right-0 z-[70] bg-[#8f2417] text-white text-[13px] font-bold text-center py-2 px-4 pt-[calc(env(safe-area-inset-top)+8px)] shadow-[0_2px_12px_rgba(0,0,0,.2)]"
      >
        No internet — nothing you enter can be saved right now
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
