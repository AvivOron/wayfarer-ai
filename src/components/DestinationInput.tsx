'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Prediction {
  description: string
  placeId: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelectPlace?: (prediction: Prediction) => void
  className?: string
  id?: string
  autoFocus?: boolean
  types?: string
  components?: string
}

export function DestinationInput({ value, onChange, onSelectPlace, className, id, autoFocus, types, components }: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(input: string) {
    onChange(input)
    if (debounce.current) clearTimeout(debounce.current)
    if (input.length < 2) { setPredictions([]); setOpen(false); return }
    debounce.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ input })
        if (types) params.set('types', types)
        if (components) params.set('components', components)
        const res = await fetch(`/wayfarer-ai/api/places/autocomplete?${params}`)
        const data = await res.json()
        setPredictions(data.predictions ?? [])
        setOpen((data.predictions ?? []).length > 0)
      } catch {
        setPredictions([])
        setOpen(false)
      }
    }, 300)
  }

  function select(prediction: Prediction) {
    onChange(prediction.description)
    onSelectPlace?.(prediction)
    setPredictions([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        placeholder="e.g. Paris, France"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        className={cn('h-12 text-base rounded-xl', className)}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {predictions.map(p => (
            <li
              key={p.placeId}
              onMouseDown={() => select(p)}
              className="px-4 py-3 text-sm cursor-pointer hover:bg-muted transition-colors"
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
