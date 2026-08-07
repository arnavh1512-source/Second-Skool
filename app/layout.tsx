import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

// Absolute base so og:image / manifest / canonical resolve to full URLs in
// production. Prefer an explicit site URL, fall back to Vercel's production
// domain, then localhost for dev. (opengraph-image.png in this folder is
// auto-wired by Next into og:image + twitter:image.)
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')

const description = 'Second Skool — attendance, results, fees, rankings & more.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Second Skool', template: '%s · Second Skool' },
  description,
  applicationName: 'Second Skool',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Second Skool', statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    siteName: 'Second Skool',
    title: 'Second Skool',
    description,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Second Skool',
    description,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // lets the app use safe-area insets on notched phones
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning on <html>: the inline script below sets --app-h on
  // it before React hydrates, so the element's style intentionally differs from
  // the server markup. Scoped to this one node (React ignores it one level deep).
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Drive the app-shell height from the real visible viewport height.
            Runs before paint (no flash) and re-syncs when the URL bar toggles,
            the keyboard opens, or the device rotates — so a refresh never leaves
            the bottom nav / buttons below the fold. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function s(){document.documentElement.style.setProperty('--app-h',window.innerHeight+'px')}s();addEventListener('resize',s);addEventListener('orientationchange',s);window.visualViewport&&visualViewport.addEventListener('resize',s)})()",
          }}
        />
      </head>
      <body className={jakarta.className}>{children}</body>
    </html>
  )
}
