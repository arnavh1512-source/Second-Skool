'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * A busy flag that cannot get stuck.
 *
 * Every `setBusy(true) … await … setBusy(false)` in this app was written
 * without try/finally, so one thrown error left the button disabled forever —
 * and several of those buttons swap their onClick to a no-op while busy, which
 * makes the dead state permanent until a reload. The ref is not redundant with
 * the state: setBusy is async, so two taps in the same tick both got through.
 */
export function useBusy(): [boolean, (fn: () => Promise<unknown> | unknown) => Promise<void>] {
  const [busy, setBusy] = useState(false)
  const running = useRef(false)

  const run = useCallback(async (fn: () => Promise<unknown> | unknown) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try { await fn() }
    finally { running.current = false; setBusy(false) }
  }, [])

  return [busy, run]
}
