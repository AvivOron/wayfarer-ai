'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Package, CheckSquare, Square, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import { Trip } from '@/types'
import { toast } from 'sonner'

interface Category {
  category: string
  items: string[]
}

interface Props {
  trip: Trip
}

export function PackingListSheet({ trip }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [generated, setGenerated] = useState(false)
  const [editingItem, setEditingItem] = useState<{ catIdx: number; itemIdx: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const [newItemValue, setNewItemValue] = useState('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/packing`)
        if (res.ok) {
          const data = await res.json()
          if (data?.categories) {
            setCategories(data.categories as Category[])
            setChecked(new Set(data.checked ?? []))
            setGenerated(true)
          }
        }
      } catch {
        // no saved list yet
      } finally {
        setInitialLoading(false)
      }
    }
    loadExisting()
  }, [trip.id])

  function scheduleSave(cats: Category[], ch: Set<string>) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await fetch(`/wayfarer-ai/api/trips/${trip.id}/packing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: cats, checked: Array.from(ch) }),
      })
    }, 600)
  }

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/wayfarer-ai/api/ai/packing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          startDate: trip.startDate.split('T')[0],
          endDate: trip.endDate.split('T')[0],
          groupType: trip.groupType,
          childAges: trip.childAges,
          interests: trip.interests,
        }),
      })
      const data = await res.json()
      if (data.categories) {
        const newCats = data.categories as Category[]
        setCategories(newCats)
        setChecked(new Set())
        setGenerated(true)
        await fetch(`/wayfarer-ai/api/trips/${trip.id}/packing`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categories: newCats, checked: [] }),
        })
      } else {
        throw new Error('No list generated')
      }
    } catch {
      toast.error('Failed to generate packing list')
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(catIdx: number, itemIdx: number) {
    const key = `${catIdx}-${itemIdx}`
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      scheduleSave(categories, next)
      return next
    })
  }

  function startEdit(catIdx: number, itemIdx: number, value: string) {
    setEditingItem({ catIdx, itemIdx })
    setEditValue(value)
  }

  function commitEdit() {
    if (!editingItem) return
    const { catIdx, itemIdx } = editingItem
    if (!editValue.trim()) { cancelEdit(); return }
    const updated = categories.map((cat, ci) =>
      ci === catIdx ? { ...cat, items: cat.items.map((item, ii) => ii === itemIdx ? editValue.trim() : item) } : cat
    )
    setCategories(updated)
    scheduleSave(updated, checked)
    setEditingItem(null)
  }

  function cancelEdit() {
    setEditingItem(null)
    setEditValue('')
  }

  function deleteItem(catIdx: number, itemIdx: number) {
    const updated = categories.map((cat, ci) =>
      ci === catIdx ? { ...cat, items: cat.items.filter((_, ii) => ii !== itemIdx) } : cat
    )
    const newChecked = new Set<string>()
    checked.forEach(key => {
      const [c, i] = key.split('-').map(Number)
      if (c === catIdx) {
        if (i < itemIdx) newChecked.add(key)
        else if (i > itemIdx) newChecked.add(`${c}-${i - 1}`)
      } else {
        newChecked.add(key)
      }
    })
    setCategories(updated)
    setChecked(newChecked)
    scheduleSave(updated, newChecked)
  }

  function addItem(catIdx: number) {
    if (!newItemValue.trim()) { setAddingTo(null); return }
    const updated = categories.map((cat, ci) =>
      ci === catIdx ? { ...cat, items: [...cat.items, newItemValue.trim()] } : cat
    )
    setCategories(updated)
    setNewItemValue('')
    setAddingTo(null)
    scheduleSave(updated, checked)
  }

  async function clearList() {
    setGenerated(false)
    setCategories([])
    setChecked(new Set())
    await fetch(`/wayfarer-ai/api/trips/${trip.id}/packing`, { method: 'DELETE' })
  }

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0)
  const checkedCount = checked.size

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <h1 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4" /> Packing List
        </h1>
        <p className="text-xs text-muted-foreground">{trip.destination} · auto-saved</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {initialLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !generated ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-6xl mb-4">🧳</div>
            <h2 className="text-lg font-semibold mb-2">No packing list yet</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-xs">
              Generate a smart packing list tailored to your destination, group, and interests.
            </p>
            <Button
              className="w-full max-w-xs bg-sky-500 hover:bg-sky-600 rounded-2xl h-12 font-semibold gap-2"
              onClick={generate}
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : 'Generate Packing List ✨'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{checkedCount}/{totalItems} packed</span>
                {checkedCount === totalItems && totalItems > 0 && (
                  <span className="text-green-600 font-medium">All packed! 🎉</span>
                )}
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-sky-500 h-2 rounded-full transition-all"
                  style={{ width: totalItems > 0 ? `${(checkedCount / totalItems) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {categories.map((cat, ci) => (
              <div key={ci}>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">{cat.category}</h3>
                <div className="space-y-1">
                  {cat.items.map((item, ii) => {
                    const key = `${ci}-${ii}`
                    const isChecked = checked.has(key)
                    const isEditing = editingItem?.catIdx === ci && editingItem?.itemIdx === ii

                    return (
                      <div key={ii} className="group flex items-center gap-2 py-2 px-2 rounded-xl hover:bg-muted/50 transition-colors">
                        <button onClick={() => toggleItem(ci, ii)} className="shrink-0">
                          {isChecked
                            ? <CheckSquare className="w-4 h-4 text-sky-500" />
                            : <Square className="w-4 h-4 text-muted-foreground" />}
                        </button>

                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-1">
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                              className="flex-1 h-7 px-2 rounded-lg border border-ring bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button onClick={commitEdit} className="text-green-600"><Check className="w-4 h-4" /></button>
                            <button onClick={cancelEdit} className="text-muted-foreground"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <span className={`flex-1 text-sm ${isChecked ? 'line-through text-muted-foreground' : ''}`}>{item}</span>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => startEdit(ci, ii, item)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteItem(ci, ii)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {addingTo === ci ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        autoFocus
                        value={newItemValue}
                        onChange={e => setNewItemValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addItem(ci); if (e.key === 'Escape') { setAddingTo(null); setNewItemValue('') } }}
                        placeholder="New item…"
                        className="flex-1 h-7 px-2 rounded-lg border border-ring bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button onClick={() => addItem(ci)} className="text-green-600"><Check className="w-4 h-4" /></button>
                      <button onClick={() => { setAddingTo(null); setNewItemValue('') }} className="text-muted-foreground"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(ci)}
                      className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground hover:text-sky-600 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={generate} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Regenerate ✨'}
              </Button>
              <Button variant="ghost" size="icon" className="rounded-2xl text-muted-foreground hover:text-destructive" onClick={clearList} title="Clear list">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
