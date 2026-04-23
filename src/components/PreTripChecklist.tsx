'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckSquare, Square, Trash2, Pencil, Plus, Check, X } from 'lucide-react'
import { Trip } from '@/types'
import { toast } from 'sonner'

interface ChecklistItem {
  emoji: string
  task: string
  category: string
}

interface Props {
  trip: Trip
}

const CATEGORY_ORDER = ['Admin', 'Transport', 'Money', 'Health', 'Connectivity', 'Packing', 'Home']

export function PreTripChecklist({ trip }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [generated, setGenerated] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addingCat, setAddingCat] = useState<string | null>(null)
  const [newTaskValue, setNewTaskValue] = useState('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/wayfarer-ai/api/trips/${trip.id}/pre-trip`)
        if (res.ok) {
          const data = await res.json()
          if (data?.items) {
            setItems(data.items as ChecklistItem[])
            setChecked(new Set((data.checked as number[]) ?? []))
            setGenerated(true)
          }
        }
      } catch {
        // no checklist yet
      } finally {
        setInitialLoading(false)
      }
    }
    load()
  }, [trip.id])

  function scheduleSave(its: ChecklistItem[], ch: Set<number>) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      await fetch(`/wayfarer-ai/api/trips/${trip.id}/pre-trip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: its, checked: Array.from(ch) }),
      })
    }, 600)
  }

  function toggle(idx: number) {
    if (editingIdx === idx) return
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      scheduleSave(items, next)
      return next
    })
  }

  function startEdit(idx: number, task: string) {
    setEditingIdx(idx)
    setEditValue(task)
  }

  function commitEdit() {
    if (editingIdx === null) return
    if (!editValue.trim()) { cancelEdit(); return }
    const updated = items.map((item, i) =>
      i === editingIdx ? { ...item, task: editValue.trim() } : item
    )
    setItems(updated)
    scheduleSave(updated, checked)
    setEditingIdx(null)
  }

  function cancelEdit() {
    setEditingIdx(null)
    setEditValue('')
  }

  function deleteItem(idx: number) {
    const updated = items.filter((_, i) => i !== idx)
    // Remap checked indices
    const newChecked = new Set<number>()
    checked.forEach(i => {
      if (i < idx) newChecked.add(i)
      else if (i > idx) newChecked.add(i - 1)
    })
    setItems(updated)
    setChecked(newChecked)
    scheduleSave(updated, newChecked)
  }

  function addItem(cat: string) {
    if (!newTaskValue.trim()) { setAddingCat(null); return }
    const newItem: ChecklistItem = { emoji: '✅', task: newTaskValue.trim(), category: cat }
    const updated = [...items, newItem]
    setItems(updated)
    setNewTaskValue('')
    setAddingCat(null)
    scheduleSave(updated, checked)
  }

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/wayfarer-ai/api/ai/pre-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: trip.destination,
          startDate: trip.startDate.split('T')[0],
          transport: trip.transport,
          groupType: trip.groupType,
          childAges: trip.childAges,
        }),
      })
      const data = await res.json()
      if (!data.items) throw new Error()
      const newItems = data.items as ChecklistItem[]
      setItems(newItems)
      setChecked(new Set())
      setGenerated(true)
      await fetch(`/wayfarer-ai/api/trips/${trip.id}/pre-trip`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: newItems, checked: [] }),
      })
    } catch {
      toast.error('Failed to generate checklist')
    } finally {
      setLoading(false)
    }
  }

  async function clear() {
    setGenerated(false)
    setItems([])
    setChecked(new Set())
    await fetch(`/wayfarer-ai/api/trips/${trip.id}/pre-trip`, { method: 'DELETE' })
  }

  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, entries: items.map((item, i) => ({ item, i })).filter(({ item }) => item.category === cat) }))
    .filter(g => g.entries.length > 0)

  const uncategorised = items
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => !CATEGORY_ORDER.includes(item.category))
  if (uncategorised.length > 0) grouped.push({ cat: 'Other', entries: uncategorised })

  const checkedCount = checked.size
  const total = items.length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Before the Trip</h2>
        {generated && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{checkedCount}/{total}</span>
            <button onClick={clear} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !generated ? (
        <Button
          variant="outline"
          className="w-full rounded-2xl h-11 gap-2 border-dashed"
          onClick={generate}
          disabled={loading}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            : '✨ Generate pre-trip checklist'}
        </Button>
      ) : (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-sky-500 h-1.5 rounded-full transition-all"
              style={{ width: total > 0 ? `${(checkedCount / total) * 100}%` : '0%' }}
            />
          </div>

          {grouped.map(({ cat, entries }) => (
            <div key={cat}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{cat}</p>
              <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
                {entries.map(({ item, i }) => (
                  <div key={i} className="group flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                    {/* Checkbox */}
                    <button onClick={() => toggle(i)} className="shrink-0">
                      {checked.has(i)
                        ? <CheckSquare className="w-4 h-4 text-sky-500" />
                        : <Square className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    <span className="text-base shrink-0">{item.emoji}</span>

                    {/* Task text or edit input */}
                    {editingIdx === i ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                          className="flex-1 h-7 px-2 rounded-lg border border-ring bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button onClick={commitEdit} className="text-green-600 shrink-0"><Check className="w-4 h-4" /></button>
                        <button onClick={cancelEdit} className="text-muted-foreground shrink-0"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <span className={`text-sm flex-1 min-w-0 ${checked.has(i) ? 'line-through text-muted-foreground' : ''}`}>
                          {item.task}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => startEdit(i, item.task)}
                            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteItem(i)}
                            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Add item row */}
                {addingCat === cat ? (
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-base shrink-0">✅</span>
                    <input
                      autoFocus
                      value={newTaskValue}
                      onChange={e => setNewTaskValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') addItem(cat)
                        if (e.key === 'Escape') { setAddingCat(null); setNewTaskValue('') }
                      }}
                      placeholder="New task…"
                      className="flex-1 h-7 px-2 rounded-lg border border-ring bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button onClick={() => addItem(cat)} className="text-green-600 shrink-0"><Check className="w-4 h-4" /></button>
                    <button onClick={() => { setAddingCat(null); setNewTaskValue('') }} className="text-muted-foreground shrink-0"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCat(cat)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-sky-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add task
                  </button>
                )}
              </div>
            </div>
          ))}

          {checkedCount === total && total > 0 && (
            <p className="text-center text-sm text-green-600 font-medium">All done! 🎉</p>
          )}

          <Button variant="outline" size="sm" className="w-full rounded-2xl" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Regenerate ✨'}
          </Button>
        </div>
      )}
    </div>
  )
}
