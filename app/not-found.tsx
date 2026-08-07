import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Page not found' }

// Branded 404 — mirrors the app's login aesthetic (brand-blue logo tile on the
// soft grey app background) instead of Next's bare default page.
export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 bg-[#f2f4f8]">
      <div
        className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center text-white font-extrabold text-3xl mb-6 shadow-[0_2px_10px_rgba(20,30,60,.12)]"
        style={{ background: 'linear-gradient(135deg,#2a6fdb,#5a93ef)' }}
      >
        S
      </div>
      <div className="text-[64px] font-extrabold leading-none text-[#1a2332]">404</div>
      <h1 className="text-xl font-extrabold text-[#1a2332] mt-3">Page not found</h1>
      <p className="text-[15px] text-[#6b7688] mt-2 max-w-[320px]">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-7 inline-flex items-center justify-center bg-[#2a6fdb] text-white text-[15px] font-extrabold py-3.5 px-7 rounded-2xl no-underline"
      >
        Back to Second Skool
      </Link>
    </main>
  )
}
