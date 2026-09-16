import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Page not found' }

// Branded 404 — mirrors the app's login aesthetic (brand-blue logo tile on the
// soft grey app background) instead of Next's bare default page.
export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 bg-td-soft">
      <div
        className="w-[72px] h-[72px] rounded-td-lg flex items-center justify-center text-white font-extrabold text-3xl mb-6 shadow-td-raised"
        style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}
      >
        S
      </div>
      <div className="text-[64px] font-extrabold leading-none text-td-dark">404</div>
      <h1 className="text-xl td-strong mt-3">Page not found</h1>
      <p className="text-td-body text-td-muted mt-2 max-w-[320px]">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center justify-center bg-td-primary text-white text-td-body font-extrabold py-3.5 px-7 rounded-td-md no-underline"
      >
        Back to Second Skool
      </Link>
    </main>
  )
}
