import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WC26 Predictor',
  description: 'World Cup 2026 score predictor',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        padding: 0,
        background: '#0f1117',
        color: '#fff',
        fontFamily: manrope.style.fontFamily,
        WebkitFontSmoothing: 'antialiased',
      }}>
        {children}
      </body>
    </html>
  )
}
