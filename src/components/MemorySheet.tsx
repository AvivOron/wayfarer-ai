'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Activity } from '@/types'
import { cn } from '@/lib/utils'

interface Props {
  activity: Activity
  emojis: string[]
  onSave: (activityId: string, emoji: string, text: string) => void
  onClose: () => void
}

export function MemorySheet({ activity, emojis, onSave, onClose }: Props) {
  const [emoji, setEmoji] = useState(activity.memoryEmoji ?? emojis[0])
  const [text, setText] = useState(activity.memory ?? '')

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left mb-4">
          <SheetTitle>Add a memory ✨</SheetTitle>
          <p className="text-sm text-muted-foreground">{activity.name}</p>
        </SheetHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">How was it?</p>
            <div className="flex gap-2 flex-wrap">
              {emojis.map(e => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    'text-2xl w-10 h-10 rounded-xl border-2 transition-all',
                    emoji === e ? 'border-primary bg-primary/5 scale-110' : 'border-border'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Notes (optional)</p>
            <Textarea
              placeholder="Worth the wait, amazing views…"
              value={text}
              onChange={e => setText(e.target.value)}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          <Button
            className="w-full bg-sky-500 hover:bg-sky-600 rounded-2xl h-12 font-semibold"
            onClick={() => onSave(activity.id, emoji, text)}
          >
            Save Memory
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
