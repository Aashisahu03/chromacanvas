import { useState, useEffect } from 'react'
import Toolbar from '@/components/Toolbar'
import LayersPanel from '@/components/LayersPanel'
import Canvas from '@/components/Canvas'
import PropertiesPanel from '@/components/PropertiesPanel'
import ContextMenu from '@/components/ContextMenu'
import Cursors, { useTrackCursor } from '@/components/Cursors'
import { ToastProvider } from '@/components/Toast'
import AIPanel from '@/components/AIPanel'
import PhysicsPanel from '@/components/PhysicsPanel'
import PatternPanel from '@/components/PatternPanel'
import ColorMoodPanel from '@/components/ColorMoodPanel'
import ImagePanel from '@/components/ImagePanel'           // ← ADD THIS
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCanvasStore, makeShape } from '@/store/canvasStore'

function AppInner() {
  useKeyboardShortcuts()
  useTrackCursor()

  const { addShape, pushHistory } = useCanvasStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handler = () => {
      const state = useCanvasStore.getState() as typeof useCanvasStore extends (...a: never[]) => infer R ? R & { _contextMenuPos?: { x: number; y: number } } : never
      const pos = (state as { _contextMenuPos?: { x: number; y: number } })._contextMenuPos
      if (pos) setContextMenu(pos)
    }
    const unsub = useCanvasStore.subscribe(handler)
    return () => unsub()
  }, [])

  useEffect(() => {
    const store = useCanvasStore.getState()
    if (store.shapes.length === 0) {
      const card = makeShape('rect', 300, 180)
      Object.assign(card, { w: 240, h: 160, fill: '#2d1265', stroke: '#7c3aed', strokeWidth: 2, name: 'Card' })
      const circle = makeShape('ellipse', 350, 210)
      Object.assign(circle, { w: 70, h: 70, fill: '#7c3aed', stroke: 'none', name: 'Avatar' })
      const title = makeShape('text', 310, 220)
      Object.assign(title, { text: 'ChromaCanvas', fontSize: 18, fontWeight: 600, fill: '#c4b5fd', name: 'Title' })
      const subtitle = makeShape('text', 310, 300)
      Object.assign(subtitle, { text: 'Draw something →', fontSize: 13, fontWeight: 400, fill: '#6d28d9', name: 'Hint' })
      const line = makeShape('arrow', 200, 150)
      Object.assign(line, { x2: 600, y2: 400, stroke: '#4c1d95', strokeWidth: 1, opacity: 0.4, name: 'Guide' })
      ;[line, card, circle, title, subtitle].forEach((s) => addShape(s))
      pushHistory()
    }
  }, [addShape, pushHistory])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0f0f11] text-[#e2e2e8] overflow-hidden font-sans">
      <Toolbar />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <LayersPanel />
        <div className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
          <Canvas />
          <Cursors />
        </div>
        <PropertiesPanel />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      <AIPanel />
      <PhysicsPanel />
      <PatternPanel />
      <ColorMoodPanel />
      <ImagePanel />     {/* ← ADD THIS */}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}