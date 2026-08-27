'use client'

import { currentTheme, setTheme } from '../lib/theme'

// Sits beside the bell and borrows its shape exactly, so the top-right corner
// reads as one pair of controls rather than a button bolted on next to one.
//
// Both icons are always in the markup and CSS picks which one shows. The
// obvious version — read the theme into state on mount — renders the wrong
// icon on the server and corrects it after hydration, which is both a
// mismatch and a visible flicker for anyone in dark mode. There is nothing
// here React needs to know about.
export function ThemeToggle() {
  const flip = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')

  return (
    <button
      onClick={flip}
      aria-label="Switch between light and dark mode"
      title="Light / dark"
      className="w-[42px] h-[42px] rounded-[14px] border border-td-border bg-td-card flex items-center justify-center cursor-pointer shrink-0"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dark:hidden">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8" />
      </svg>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-td-amber)" strokeWidth="2" strokeLinecap="round" className="hidden dark:block">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  )
}
