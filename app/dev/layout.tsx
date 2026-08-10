import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Developer console',
  // Operator-only surface. It is access-controlled server-side regardless, but
  // there is no reason for it to be discoverable at all.
  robots: { index: false, follow: false, nocache: true },
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return children
}
