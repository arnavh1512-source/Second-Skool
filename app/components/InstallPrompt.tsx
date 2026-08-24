'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDashboard } from '../store'
import { readLocal, writeLocal } from '../lib/storage'

// Nothing in the app ever asked anyone to install it.
//
// That matters more here than in most products. Second Skool is a PWA whose
// entire notification story — the absence alerts parents get, the reminders
// students get — runs through a service worker. On iOS, web push does not work
// at all until the site is added to the Home Screen, and on Android a tab that
// lives in a browser's tab strip is one that gets closed and never reopened.
// The manifest was correct and the service worker registered, so Chrome fired
// `beforeinstallprompt` on every eligible visit and, with no listener, the
// browser's own mini-infobar was the only invitation — which Chrome stopped
// showing years ago. The result: a teacher bookmarks a URL, or does nothing.
//
// So: catch the event, keep it, and ask her plainly once she is actually
// signed in and has seen what the app does. Never on the login screen — an
// install prompt before she has any reason to want the app is the fastest way
// to get it dismissed for good.

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ss.install.dismissed'
const SNOOZE_DAYS = 14

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

// iOS Safari never fires beforeinstallprompt and exposes no install API at all,
// so the only thing that works there is telling her which buttons to press.
const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent)

const snoozed = () => {
  const at = Number(readLocal(DISMISS_KEY) || 0)
  return at > 0 && Date.now() - at < SNOOZE_DAYS * 864e5
}

const remember = () => writeLocal(DISMISS_KEY, String(Date.now()))

export function InstallPrompt() {
  const role = useDashboard(s => s.role)

  // Whether we are already installed, whether she has snoozed the prompt, and
  // whether this is iOS are all fixed for the life of the page — environment,
  // not state. Reading them in a lazy initialiser keeps them out of an effect,
  // where a synchronous setState would only cause a second render pass. On the
  // server every guard is false and `role` is null, so the first paint renders
  // nothing either way and the two passes agree.
  const [eligible] = useState(() => !isStandalone() && !snoozed())
  const [ios] = useState(isIos)

  const [deferred, setDeferred] = useState<InstallEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showIosSteps, setShowIosSteps] = useState(false)

  useEffect(() => {
    if (!eligible) return

    const onPrompt = (e: Event) => {
      // Without preventDefault Chrome may show its own UI as well, and the
      // event cannot be replayed later from a button press.
      e.preventDefault()
      setDeferred(e as InstallEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setDismissed(true)
      remember()
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [eligible])

  const dismiss = useCallback(() => {
    setDismissed(true)
    setShowIosSteps(false)
    remember()
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    // Either way the event is spent and cannot be reused. A decline is snoozed
    // rather than remembered forever — she may change her mind next term.
    if (outcome === 'dismissed') remember()
    setDismissed(true)
  }, [deferred])

  // Signed in only: she has to have seen the app before being asked to keep it.
  if (!eligible || dismissed || !role) return null
  if (!deferred && !ios) return null

  if (showIosSteps) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[65] bg-white border-t border-td-border rounded-t-[20px] px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+18px)] shadow-[0_-10px_40px_rgba(20,30,60,.18)]">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <h2 className="text-[15px] font-extrabold text-td-dark">Add Second Skool to your Home Screen</h2>
          <button type="button" onClick={dismiss} aria-label="Close" className="shrink-0 text-td-muted text-[20px] leading-none cursor-pointer px-1">×</button>
        </div>
        <p className="text-[13px] text-td-muted mb-3 leading-relaxed">
          Reminders and alerts only work once the app is on your Home Screen.
        </p>
        <ol className="text-[13px] text-td-dark space-y-2 mb-1">
          <li className="flex gap-2.5"><span className="font-extrabold text-td-primary">1.</span><span>Tap the <strong>Share</strong> button at the bottom of Safari.</span></li>
          <li className="flex gap-2.5"><span className="font-extrabold text-td-primary">2.</span><span>Scroll down and tap <strong>Add to Home Screen</strong>.</span></li>
          <li className="flex gap-2.5"><span className="font-extrabold text-td-primary">3.</span><span>Tap <strong>Add</strong>. Open Second Skool from the icon after that.</span></li>
        </ol>
      </div>
    )
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[65] bg-td-dark text-white px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex items-center gap-3 shadow-[0_-8px_30px_rgba(0,0,0,.24)]">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-extrabold leading-tight">Install Second Skool</div>
        <div className="text-[12px] opacity-80 leading-tight mt-0.5">Opens like an app — and reminders only work once it&apos;s installed.</div>
      </div>
      <button
        type="button"
        onClick={ios && !deferred ? () => setShowIosSteps(true) : install}
        className="shrink-0 bg-white text-td-dark text-[13px] font-extrabold px-4 py-2 rounded-[11px] cursor-pointer"
      >
        {ios && !deferred ? 'How' : 'Install'}
      </button>
      <button type="button" onClick={dismiss} aria-label="Not now" className="shrink-0 text-white/70 text-[22px] leading-none cursor-pointer px-1">×</button>
    </div>
  )
}
