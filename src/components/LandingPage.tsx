'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { MapPin, Compass, Zap, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FEATURES = [
  { icon: Compass, title: 'Smart Planning', desc: 'AI builds your perfect itinerary around your interests, group, and travel style.' },
  { icon: MapPin, title: 'Places Search', desc: 'Find must-see spots with Google Maps integration and save them instantly.' },
  { icon: Zap, title: 'Live Mode', desc: "Real-time AI recommendations based on where you are, what's open, and the weather." },
  { icon: Map, title: 'Offline Itinerary', desc: 'Your schedule is cached so you can access it without cell signal.' },
]

export function LandingPage() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Use the callbackUrl from the middleware redirect if present, otherwise default to /app.
  // Always make it absolute so NextAuth doesn't resolve it against the internal Vercel hostname.
  const rawCallback = searchParams.get('callbackUrl')
  const callbackUrl = rawCallback
    ? rawCallback.startsWith('http')
      ? rawCallback
      : `${window.location.origin}${rawCallback}`
    : `${typeof window !== 'undefined' ? window.location.origin : ''}/wayfarer-ai/app`

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(rawCallback ?? '/wayfarer-ai/app')
    }
  }, [status, router, rawCallback])

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sand-100 flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 text-6xl animate-fade-in">✈️</div>
        <h1 className="text-4xl md:text-5xl font-bold text-ocean-700 mb-4 animate-fade-in">
          Wayfarer AI
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-md mb-8 animate-fade-in">
          Your AI-powered travel companion. Plan smarter, explore better, and never miss a hidden gem.
        </p>

        <Button
          size="lg"
          onClick={() => signIn('google', { callbackUrl })}
          disabled={status === 'loading'}
          className="bg-sky-500 hover:bg-sky-600 text-white rounded-2xl px-8 py-6 text-lg font-semibold shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <p className="mt-4 text-sm text-muted-foreground">Free to use · No credit card required</p>
      </main>

      {/* Features */}
      <section className="px-6 pb-16">
        <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/80 backdrop-blur rounded-2xl p-4 border border-border/50 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="font-semibold text-sm text-foreground mb-1">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center pb-8 text-xs text-muted-foreground">
        Built with ♥ · avivo.dev
      </footer>
    </div>
  )
}
