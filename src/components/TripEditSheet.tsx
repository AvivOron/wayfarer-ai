'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DestinationInput } from '@/components/DestinationInput'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Trip, AccommodationType, INTEREST_OPTIONS, TRANSPORT_OPTIONS, GROUP_TYPE_OPTIONS, FOOD_PREFERENCE_OPTIONS, DIETARY_RESTRICTION_OPTIONS, ACCOMMODATION_TYPE_OPTIONS } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  trip: Trip
  onClose: () => void
  onSaved: (updated: Trip) => void
}

interface EditData {
  title: string
  destination: string
  countryCode: string | null
  startDate: string
  endDate: string
  hotelAddress: string
  accommodationType: AccommodationType
  transport: string
  groupType: string
  groupSize: number
  childAges: number[]
  interests: string[]
  foodPreferences: string[]
  dietaryRestrictions: string[]
  notes: string
}

const STEPS = [
  { title: 'Destination & name', subtitle: 'Where are you going?' },
  { title: 'Dates', subtitle: 'When are you travelling?' },
  { title: 'Accommodation', subtitle: 'Where are you staying?' },
  { title: 'Group', subtitle: 'Who\'s coming?' },
  { title: 'Interests', subtitle: 'What do you love to do?' },
  { title: 'Food & dining', subtitle: 'Let us find the perfect spots' },
  { title: 'Anything else?', subtitle: 'Fixed plans or special requests' },
]

export function TripEditSheet({ trip, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<EditData>({
    title: trip.title,
    destination: trip.destination,
    countryCode: null,
    startDate: trip.startDate.split('T')[0],
    endDate: trip.endDate.split('T')[0],
    hotelAddress: trip.hotelAddress ?? '',
    accommodationType: (trip.accommodationType ?? 'hotel') as AccommodationType,
    transport: trip.transport,
    groupType: trip.groupType,
    groupSize: trip.groupSize,
    childAges: trip.childAges,
    interests: trip.interests,
    foodPreferences: trip.foodPreferences ?? [],
    dietaryRestrictions: trip.dietaryRestrictions ?? [],
    notes: trip.notes ?? '',
  })

  useEffect(() => {
    async function seedCountryCode() {
      try {
        const params = new URLSearchParams({ input: trip.destination, types: '(cities)' })
        const res = await fetch(`/wayfarer-ai/api/places/autocomplete?${params}`)
        const json = await res.json()
        const first = json.predictions?.[0]
        if (!first) return
        const detail = await fetch(`/wayfarer-ai/api/places/detail?placeId=${first.placeId}`)
        const d = await detail.json()
        if (d.countryCode) setData(prev => ({ ...prev, countryCode: d.countryCode }))
      } catch {
        // non-critical
      }
    }
    seedCountryCode()
  }, [trip.destination])

  function update(patch: Partial<EditData>) {
    setData(d => ({ ...d, ...patch }))
  }

  function canProceed() {
    if (step === 0) return data.destination.trim().length > 0
    if (step === 1) return data.startDate && data.endDate && data.startDate <= data.endDate
    if (step === 2) return true
    if (step === 3) return data.groupSize >= 1
    if (step === 4) return data.interests.length > 0
    if (step === 5) return true
    if (step === 6) return true
    return false
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          title: data.title.trim() || `${data.destination} Trip`,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
          notes: data.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      toast.success('Trip updated!')
      onSaved(updated)
      onClose()
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[92vh] flex flex-col p-0" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <SheetTitle className="text-base">Edit Trip</SheetTitle>
            <p className="text-xs text-muted-foreground">{STEPS[step].subtitle}</p>
          </div>
          <span className="text-xs text-muted-foreground">{step + 1}/{STEPS.length}</span>
        </div>

        {/* Step tabs */}
        <div className="flex gap-1 px-4 pt-3 shrink-0">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                'flex-1 h-1 rounded-full transition-all',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h2 className="text-xl font-bold mb-1">{STEPS[step].title}</h2>
          {step === 0 && <StepDestination data={data} update={update} />}
          {step === 1 && <StepDates data={data} update={update} />}
          {step === 2 && <StepHotel data={data} update={update} />}
          {step === 3 && <StepGroup data={data} update={update} />}
          {step === 4 && <StepInterests data={data} update={update} />}
          {step === 5 && <StepFood data={data} update={update} />}
          {step === 6 && <StepNotes data={data} update={update} />}
        </div>

        {/* Footer */}
        <div className="px-6 pt-4 border-t border-border shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {step < STEPS.length - 1 ? (
            <Button
              className="w-full bg-sky-500 hover:bg-sky-600 rounded-2xl h-12 text-base font-semibold gap-2"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="w-full bg-sky-500 hover:bg-sky-600 rounded-2xl h-12 text-base font-semibold gap-2"
              onClick={handleSave}
              disabled={!canProceed() || saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StepDestination({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label htmlFor="destination">Destination</Label>
        <DestinationInput
          id="destination"
          value={data.destination}
          onChange={v => update({ destination: v, countryCode: null })}
          onSelectPlace={async ({ placeId }) => {
            try {
              const res = await fetch(`/wayfarer-ai/api/places/detail?placeId=${placeId}`)
              const d = await res.json()
              if (d.countryCode) update({ countryCode: d.countryCode })
            } catch { /* non-critical */ }
          }}
          className="mt-1"
          autoFocus
          types="(cities)"
        />
      </div>
      <div>
        <Label htmlFor="title">Trip name</Label>
        <Input
          id="title"
          placeholder={`${data.destination} Trip`}
          value={data.title}
          onChange={e => update({ title: e.target.value })}
          className="mt-1 h-12 text-base rounded-xl"
        />
      </div>
    </div>
  )
}

function StepDates({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  const nights = data.startDate && data.endDate && data.startDate <= data.endDate
    ? Math.round((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86400000)
    : null

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label htmlFor="startDate">Departure date</Label>
        <Input
          id="startDate"
          type="date"
          value={data.startDate}
          onChange={e => update({ startDate: e.target.value })}
          className="mt-1 h-12 text-base rounded-xl"
        />
      </div>
      <div>
        <Label htmlFor="endDate">Return date</Label>
        <Input
          id="endDate"
          type="date"
          value={data.endDate}
          onChange={e => update({ endDate: e.target.value })}
          className="mt-1 h-12 text-base rounded-xl"
          min={data.startDate}
        />
      </div>
      {nights !== null && (
        <p className="text-sm text-muted-foreground text-center">{nights} nights</p>
      )}
    </div>
  )
}

function StepHotel({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label className="mb-2 block">Where are you staying?</Label>
        <div className="grid grid-cols-5 gap-2">
          {ACCOMMODATION_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ accommodationType: opt.value })}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-2xl border-2 transition-all',
                data.accommodationType === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              )}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-[11px] font-medium leading-tight text-center">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="hotel">Address or name</Label>
        <DestinationInput
          id="hotel"
          value={data.hotelAddress}
          onChange={v => update({ hotelAddress: v })}
          className="mt-1"
          components={data.countryCode ? `country:${data.countryCode}` : undefined}
        />
        <p className="text-xs text-muted-foreground mt-2">Used to calculate travel times in your itinerary</p>
      </div>
      <div>
        <Label className="mb-2 block">How will you get around?</Label>
        <div className="grid grid-cols-3 gap-3">
          {TRANSPORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ transport: opt.value })}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all',
                data.transport === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              )}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepGroup({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  function setChildAges(count: number) {
    const ages = Array.from({ length: count }, (_, i) => data.childAges[i] ?? 5)
    update({ childAges: ages })
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <Label className="mb-2 block">Trip type</Label>
        <div className="grid grid-cols-2 gap-3">
          {GROUP_TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update({ groupType: opt.value })}
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left',
                data.groupType === opt.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              )}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Total people</Label>
        <div className="flex items-center gap-4 mt-2">
          <Button variant="outline" size="icon" className="rounded-full"
            onClick={() => update({ groupSize: Math.max(1, data.groupSize - 1) })}>−</Button>
          <span className="text-2xl font-bold w-8 text-center">{data.groupSize}</span>
          <Button variant="outline" size="icon" className="rounded-full"
            onClick={() => update({ groupSize: data.groupSize + 1 })}>+</Button>
        </div>
      </div>
      {data.groupType === 'family' && (
        <div>
          <Label>Number of children</Label>
          <div className="flex items-center gap-4 mt-2">
            <Button variant="outline" size="icon" className="rounded-full"
              onClick={() => setChildAges(Math.max(0, data.childAges.length - 1))}>−</Button>
            <span className="text-2xl font-bold w-8 text-center">{data.childAges.length}</span>
            <Button variant="outline" size="icon" className="rounded-full"
              onClick={() => setChildAges(data.childAges.length + 1)}>+</Button>
          </div>
          {data.childAges.length > 0 && (
            <div className="mt-3 space-y-2">
              {data.childAges.map((age, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Label className="w-20 text-sm">Child {i + 1} age</Label>
                  <Input
                    type="number" min={0} max={17} value={age}
                    onChange={e => {
                      const ages = [...data.childAges]
                      ages[i] = parseInt(e.target.value) || 0
                      update({ childAges: ages })
                    }}
                    className="w-20 h-9 text-center rounded-xl"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepInterests({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  function toggle(value: string) {
    update({
      interests: data.interests.includes(value)
        ? data.interests.filter(i => i !== value)
        : [...data.interests, value],
    })
  }
  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground mb-4">Pick everything that excites you (at least 1)</p>
      <div className="grid grid-cols-2 gap-3">
        {INTEREST_OPTIONS.map(opt => {
          const active = data.interests.includes(opt.value)
          return (
            <button key={opt.value} onClick={() => toggle(opt.value)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left',
                active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50'
              )}>
              <span className="text-xl">{opt.emoji}</span>
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StepFood({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  const [customFood, setCustomFood] = useState('')

  function toggleFood(value: string) {
    update({
      foodPreferences: data.foodPreferences.includes(value)
        ? data.foodPreferences.filter(f => f !== value)
        : [...data.foodPreferences, value],
    })
  }

  function toggleDiet(value: string) {
    update({
      dietaryRestrictions: data.dietaryRestrictions.includes(value)
        ? data.dietaryRestrictions.filter(d => d !== value)
        : [...data.dietaryRestrictions, value],
    })
  }

  function addCustomFood(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && customFood.trim()) {
      const val = customFood.trim()
      if (!data.foodPreferences.includes(val)) {
        update({ foodPreferences: [...data.foodPreferences, val] })
      }
      setCustomFood('')
    }
  }

  return (
    <div className="space-y-6 mt-4">
      <div>
        <p className="text-sm font-semibold mb-3">What food do you love?</p>
        <div className="grid grid-cols-2 gap-2">
          {FOOD_PREFERENCE_OPTIONS.map(opt => {
            const active = data.foodPreferences.includes(opt.value)
            return (
              <button key={opt.value} onClick={() => toggleFood(opt.value)}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left',
                  active ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                )}>
                <span className="text-lg">{opt.emoji}</span>
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3">
          <input
            className="w-full h-9 px-3 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add custom (e.g. Thai food)… press Enter"
            value={customFood}
            onChange={e => setCustomFood(e.target.value)}
            onKeyDown={addCustomFood}
          />
        </div>
        {data.foodPreferences.filter(f => !FOOD_PREFERENCE_OPTIONS.some(o => o.value === f)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.foodPreferences
              .filter(f => !FOOD_PREFERENCE_OPTIONS.some(o => o.value === f))
              .map(f => (
                <span key={f} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs rounded-full px-2.5 py-1">
                  {f}
                  <button onClick={() => toggleFood(f)} className="ml-0.5 hover:text-destructive">×</button>
                </span>
              ))}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold mb-3">Any dietary restrictions?</p>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_RESTRICTION_OPTIONS.map(opt => {
            const active = data.dietaryRestrictions.includes(opt.value)
            return (
              <button key={opt.value} onClick={() => toggleDiet(opt.value)}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left',
                  active ? 'border-destructive bg-destructive/5 text-destructive' : 'border-border bg-card text-muted-foreground hover:border-destructive/50'
                )}>
                <span className="text-lg">{opt.emoji}</span>
                <span className="text-xs font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StepNotes({ data, update }: { data: EditData; update: (p: Partial<EditData>) => void }) {
  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-muted-foreground">
        Fixed plans, booked events, or special requests. The AI will schedule everything else around them.
      </p>
      <textarea
        className="w-full min-h-[180px] px-4 py-3 rounded-2xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        placeholder={"Monday 6pm — Bruno Mars concert at the O2\nTuesday morning — free, no plans\nWe want at least one fancy dinner"}
        value={data.notes}
        onChange={e => update({ notes: e.target.value })}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">Optional — leave blank if no fixed commitments.</p>
    </div>
  )
}
