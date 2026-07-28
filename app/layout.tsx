import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Second Skool',
  description: 'Second Skool — attendance, results, fees, rankings & more.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Second Skool', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // lets the app use safe-area insets on notched phones
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
