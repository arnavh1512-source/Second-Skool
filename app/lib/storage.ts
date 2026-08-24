// localStorage that cannot throw.
//
// `typeof window !== 'undefined'` is not enough of a guard. Safari with
// cookies blocked, and Firefox with dom.storage disabled, throw on *access to
// the property itself* — not just on setItem — so every bare `localStorage.x`
// is a crash waiting for one visitor's privacy settings. InstallPrompt already
// wrapped its own accesses; this is the same protection, spelled once.

export function readLocal(key: string): string | null {
  try { return typeof window === 'undefined' ? null : localStorage.getItem(key) }
  catch { return null }
}

export function writeLocal(key: string, value: string): void {
  try { if (typeof window !== 'undefined') localStorage.setItem(key, value) }
  catch { /* private mode — the feature degrades, the app does not crash */ }
}

export function removeLocal(key: string): void {
  try { if (typeof window !== 'undefined') localStorage.removeItem(key) }
  catch { /* private mode */ }
}
