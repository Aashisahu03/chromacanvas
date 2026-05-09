// ─────────────────────────────────────────────────────────────────────────────
// Multiplayer cursors — requires Liveblocks setup (see liveblocks.config.ts)
// This component renders other users' cursors as an overlay on the canvas.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { worldToScreen } from '@/utils/canvasGeometry'

// Simulated cursor data shape (matches Liveblocks UserPresence)
interface RemoteCursor {
  id: string
  name: string
  color: string
  cursor: { x: number; y: number } | null
}

interface Props {
  // Pass in others from useOthers() when Liveblocks is configured
  others?: RemoteCursor[]
}

export default function Cursors({ others = [] }: Props) {
  const { viewport } = useCanvasStore()

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {others.map((user) => {
        if (!user.cursor) return null
        const sc = worldToScreen(user.cursor.x, user.cursor.y, viewport)

        return (
          <div
            key={user.id}
            className="absolute"
            style={{ left: sc.x, top: sc.y, transform: 'translate(-2px, -2px)' }}
          >
            {/* Cursor SVG */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 2L17 10L10 11L7 18L3 2Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute top-4 left-3 px-2 py-0.5 rounded text-[10px] font-mono text-white whitespace-nowrap"
              style={{ background: user.color }}
            >
              {user.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveCursors — drop-in replacement that uses actual Liveblocks
// Uncomment and use this instead of the above when Liveblocks is configured:
// ─────────────────────────────────────────────────────────────────────────────

/*
import { useOthers, useUpdateMyPresence } from '@/liveblocks.config'
import { screenToWorld } from '@/utils/canvasGeometry'

export function LiveCursors() {
  const others = useOthers()
  const updatePresence = useUpdateMyPresence()
  const { viewport } = useCanvasStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const w = screenToWorld(e.clientX, e.clientY, viewport)
      updatePresence({ cursor: { x: w.x, y: w.y } })
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [viewport, updatePresence])

  const remoteCursors = others.map((user) => ({
    id: user.connectionId.toString(),
    name: user.presence.name || 'Anonymous',
    color: user.presence.color || '#8b5cf6',
    cursor: user.presence.cursor,
  }))

  return <Cursors others={remoteCursors} />
}
*/

// Track your own cursor position for Liveblocks
export function useTrackCursor() {
  const { viewport } = useCanvasStore()

  useEffect(() => {
    const handler = () => {
      // When Liveblocks is enabled, call updatePresence here:
      // const w = screenToWorld(e.clientX, e.clientY, viewport)
      // updatePresence({ cursor: { x: w.x, y: w.y } })
      void viewport // suppress unused warning
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [viewport])
}
