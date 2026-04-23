import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Wayfarer AI — Your AI Trip Companion',
  description: 'Plan trips intelligently and get real-time AI recommendations while exploring.',
  icons: { icon: '/wayfarer-ai/favicon.svg', shortcut: '/wayfarer-ai/favicon.svg' },
  manifest: '/wayfarer-ai/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Wayfarer AI',
  },
  openGraph: {
    title: 'Wayfarer AI',
    description: 'Your AI-powered trip companion',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/wayfarer-ai/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased min-h-screen bg-background">
        <Providers>
          {children}
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  )
}
