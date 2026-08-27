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
  // No maximumScale. It was here to stop iOS zooming on input focus, but it
  // also blocks pinch-zoom outright — and the people most likely to pinch a
  // fee table or a marks row are parents reading small text on an old phone.
  // The cost is that iOS zooms in when focusing an input under 16px, which
  // several forms use — a cosmetic nuisance, and the right fix is 16px inputs,
  // not taking pinch-zoom away from everyone.
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
        {/* Stamp the theme before anything paints. A saved choice wins; with
            none, the OS preference is resolved to a literal light/dark here
            rather than left to a media query, so the toggle can override the
            OS in both directions instead of only ever agreeing with it. Doing
            this after hydration would show every dark-mode user a white flash
            on every single load. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var t;try{t=localStorage.getItem('td-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=window.matchMedia&&matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',t)})()",
          }}
        />
      </head>
      <body className={jakarta.className}>{children}</body>
    </html>
  )
}
