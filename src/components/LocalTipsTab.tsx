'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, Lightbulb, Trash2, ArrowLeft } from 'lucide-react'
import { Trip } from '@/types'
import { toast } from 'sonner'

interface TipItem {
  emoji: string
  tip: string
}

interface TipsSection {
  title: string
  items: TipItem[]
}

interface Props {
  trip: Trip
}

export function LocalTipsTab({ trip }: Props) {
  const [sections, setSections] = useState<TipsSection[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [generated, setGenerated] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/local-tips`)
        if (res.ok) {
          const data = await res.json()
          if (data?.sections) {
            setSections(data.sections as TipsSection[])
            setGenerated(true)
          }
        }
      } catch {
        // no tips yet
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [trip.id])

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/wayfarer-ai/api/ai/local-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          groupType: trip.groupType,
          transport: trip.transport,
        }),
      })
      const data = await res.json()
      if (!data.sections) throw new Error()
      setSections(data.sections)
      setGenerated(true)
      await fetch(`/wayfarer-ai/api/trips/${trip.id}/local-tips`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: data.sections }),
      })
    } catch {
      toast.error('Failed to generate local tips')
    } finally {
      setLoading(false)
    }
  }

  async function clear() {
    setGenerated(false)
    setSections([])
    await fetch(`/wayfarer-ai/api/trips/${trip.id}/local-tips`, { method: 'DELETE' })
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/app" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Local Tips
          </h1>
          <p className="text-xs text-muted-foreground">{trip.destination}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        {initialLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !generated ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-lg font-semibold mb-2">No tips yet</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-xs">
              Get insider tips on transport, tipping culture, tap water, local customs, and more.
            </p>
            <Button
              className="w-full max-w-xs bg-sky-500 hover:bg-sky-600 rounded-2xl h-12 font-semibold gap-2"
              onClick={generate}
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : 'Get Local Tips ✨'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {sections.map((section, si) => (
              <div key={si} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="text-sm font-semibold">{section.title}</h2>
                </div>
                <div className="divide-y divide-border">
                  {section.items.map((item, ii) => (
                    <div key={ii} className="flex items-start gap-3 px-4 py-3">
                      <span className="text-xl shrink-0 mt-0.5">{item.emoji}</span>
                      <p className="text-sm leading-relaxed">{item.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate ✨'}
              </Button>
              <Button variant="ghost" size="icon" className="rounded-2xl text-muted-foreground hover:text-destructive" onClick={clear} title="Clear tips">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
