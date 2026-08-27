// Light/dark, in the only two places it can honestly live: a `data-theme`
// stamp on <html> that the CSS reads, and one localStorage key so the choice
// survives a reload. There is no React state here on purpose — the inline
// script in layout.tsx sets the stamp before first paint, which is the whole
// point of it, and a copy in the store would be a second source of truth that
// starts out wrong on the server.
import { writeLocal } from './storage'

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'td-theme'

export const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'

export function setTheme(next: Theme): void {
  document.documentElement.dataset.theme = next
  writeLocal(THEME_KEY, next)
}
