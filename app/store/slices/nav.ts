import type { Slice } from '../slice'
import type { Screen, Tab, ToastKind } from '../types'

let toastTimer: ReturnType<typeof setTimeout> | null = null

// Everything used to sit on screen for 2000ms, successes and failures alike.
// A teacher who taps Save and looks up at the class has already missed the
// message by the time she looks back — and the one that matters is the failure,
// because she walks away believing the attendance saved. Failures now stay long
// enough to read twice and can be dismissed by tapping; successes are still a
// glance.
const TOAST_MS: Record<ToastKind, number> = { info: 2600, error: 9000 }

export const createNavSlice: Slice<'go' | 'goFrom' | 'back' | 'notify' | 'dismissToast' | 'setOnline' | 'set' | 'exitAdmin'> = (set, get) => ({
  go: (screen, tab) => set({ screen, tab: (tab ?? screen) as Tab, origin: null }),
  goFrom: (screen, tab, origin) => set({ screen, tab, origin }),
  // Return to where the screen was opened from. More sub-screens are entered
  // with origin='more' so Back lands on More (not Home); admin keeps its own
  // origin; everything else falls back to Home.
  back: () => {
    const { origin } = get()
    const dest: Screen = origin === 'admin' ? 'admin' : origin === 'more' ? 'more' : 'home'
    set({ origin: null, screen: dest })
  },

  notify: (msg, kind = 'info') => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: msg, toastKind: kind })
    toastTimer = setTimeout(() => set({ toast: '', toastKind: 'info' }), TOAST_MS[kind])
  },

  dismissToast: () => {
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = null
    set({ toast: '', toastKind: 'info' })
  },

  setOnline: (v) => set({ online: v }),

  set: (partial) => set(partial),

  exitAdmin: () => set({ screen: 'home', tab: 'home', origin: null }),
})
