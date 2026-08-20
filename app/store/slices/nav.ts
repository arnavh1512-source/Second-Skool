import type { Slice } from '../slice'
import type { Screen, Tab } from '../types'

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const createNavSlice: Slice<'go' | 'goFrom' | 'back' | 'notify' | 'set' | 'exitAdmin'> = (set, get) => ({
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

  notify: (msg) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: msg })
    toastTimer = setTimeout(() => set({ toast: '' }), 2000)
  },

  set: (partial) => set(partial),

  exitAdmin: () => set({ screen: 'home', tab: 'home', origin: null }),
})
