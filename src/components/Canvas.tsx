import { useRef, useEffect, useCallback, useState } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction'
import {
  drawGrid, drawShape, drawSelectionOutline,
  drawMultiSelectBox, drawRubberBand, drawPreviewShape,
} from '@/utils/canvasRenderer'
import { getMultiBoundingBox, screenToWorld, worldToScreen } from '@/utils/canvasGeometry'
import { preloadImage, onImageLoaded } from '@/utils/imageCache'
import type { Shape, TextShape, ImageShape } from '@/types'

interface TextEditState {
  id: string
  screenX: number
  screenY: number
  screenW: number
  screenH: number
  fontSize: number
  fontWeight: number
  fontFamily: string
  italic: boolean
  color: string
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const store = useCanvasStore()
  useCanvasInteraction(canvasRef)

  const [textEdit, setTextEdit] = useState<TextEditState | null>(null)

  const finishTextEdit = useCallback(() => {
    setTextEdit(null)
    store.setEditingText(null)
    store.pushHistory()
  }, [store])

  const openTextEditor = useCallback((ts: TextShape) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasRect = canvas.getBoundingClientRect()
    const { viewport } = store
    const screenPos = worldToScreen(ts.x, ts.y, viewport)
    store.setSelected([ts.id])
    store.setEditingText(ts.id)
    setTextEdit({
      id: ts.id,
      screenX: canvasRect.left + screenPos.x,
      screenY: canvasRect.top + screenPos.y,
      screenW: Math.max((ts.w || 200) * viewport.zoom, 120),
      screenH: Math.max((ts.h || 40) * viewport.zoom, 36),
      fontSize: ts.fontSize * viewport.zoom,
      fontWeight: ts.fontWeight,
      fontFamily: ts.fontFamily,
      italic: ts.italic,
      color: ts.fill,
    })
  }, [store])

  // Native dblclick listener on canvas element
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { viewport, shapes } = store
      const wp = screenToWorld(cx, cy, viewport)
      for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i]
        if (s.hidden || s.locked || s.type !== 'text') continue
        const ts = s as TextShape
        const w = Math.max(ts.w || 200, 60)
        const h = Math.max(ts.h || ts.fontSize * 1.5, 20)
        if (wp.x >= ts.x - 10 && wp.x <= ts.x + w + 10 &&
            wp.y >= ts.y - 10 && wp.y <= ts.y + h + 10) {
          openTextEditor(ts)
          return
        }
      }
    }
    canvas.addEventListener('dblclick', onDblClick)
    return () => canvas.removeEventListener('dblclick', onDblClick)
  }, [store, openTextEditor])

  useEffect(() => {
    if (textEdit) setTimeout(() => textareaRef.current?.focus(), 30)
  }, [textEdit])

  useEffect(() => {
    if (!textEdit) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finishTextEdit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [textEdit, finishTextEdit])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const { shapes, selectedIds, viewport, showGrid, activeTool } = store

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0f0f11'
    ctx.fillRect(0, 0, W, H)

    if (showGrid) drawGrid(ctx, viewport, W, H)

    ctx.save()
    ctx.translate(viewport.x, viewport.y)
    ctx.scale(viewport.zoom, viewport.zoom)
    for (const shape of shapes) {
      if (!shape.hidden) drawShape(ctx, shape)
    }
    ctx.restore()

    const vp = viewport as typeof viewport & {
      _drawPreview?: { x: number; y: number; x2?: number; y2?: number; wx2?: number; wy2?: number }
    }
    if (activeTool !== 'select' && activeTool !== 'hand' && vp._drawPreview) {
      const dp = vp._drawPreview
      const previewShape = {
        id: '__preview__', type: activeTool as Shape['type'],
        x: dp.x, y: dp.y, opacity: 0.7, hidden: false, locked: false, name: '',
      } as Partial<Shape>
      if (activeTool === 'line' || activeTool === 'arrow') {
        Object.assign(previewShape, { x2: dp.x2 ?? dp.x, y2: dp.y2 ?? dp.y, stroke: '#8b5cf6', strokeWidth: 2 })
      } else {
        Object.assign(previewShape, {
          w: (dp.wx2 ?? dp.x) - dp.x, h: (dp.wy2 ?? dp.y) - dp.y,
          fill: '#6d28d9', stroke: '#8b5cf6', strokeWidth: 1, cornerRadius: 0,
        })
      }
      drawPreviewShape(ctx, previewShape as Shape, viewport)
    }

    for (const id of selectedIds) {
      const s = shapes.find((sh) => sh.id === id)
      if (s && !s.hidden) drawSelectionOutline(ctx, s, viewport)
    }

    if (selectedIds.length > 1) {
      const selected = shapes.filter((s) => selectedIds.includes(s.id) && !s.hidden)
      const bb = getMultiBoundingBox(selected)
      if (bb) drawMultiSelectBox(ctx, bb.x, bb.y, bb.w, bb.h, viewport)
    }

    const vpAny = viewport as typeof viewport & { _rubberBand?: { x: number; y: number; w: number; h: number } }
    if (vpAny._rubberBand) drawRubberBand(ctx, vpAny._rubberBand.x, vpAny._rubberBand.y, vpAny._rubberBand.w, vpAny._rubberBand.h)
  }, [store])

  useEffect(() => {
    let running = true
    const loop = () => { if (!running) return; render(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [render])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const target = canvas.parentElement!
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvas.width = Math.floor(entry.contentRect.width)
        canvas.height = Math.floor(entry.contentRect.height)
      }
    })
    ro.observe(target)
    canvas.width = Math.floor(target.clientWidth)
    canvas.height = Math.floor(target.clientHeight)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onCtx = (e: MouseEvent) => {
      e.preventDefault()
      useCanvasStore.setState({ _contextMenuPos: { x: e.clientX, y: e.clientY } } as never)
    }
    canvas.addEventListener('contextmenu', onCtx)
    return () => canvas.removeEventListener('contextmenu', onCtx)
  }, [])

  // Preload images for any image shapes on the canvas
  useEffect(() => {
    for (const shape of store.shapes) {
      if (shape.type === 'image') {
        preloadImage((shape as ImageShape).src)
      }
    }
  }, [store.shapes])

  // Force a render pass whenever a cached image finishes loading
  // (so "Loading…" placeholder gets replaced with the real image)
 useEffect(() => {
  const unsub = onImageLoaded(() => render())
  return () => { unsub() }
}, [render])

  const { activeTool } = store
  const cursorMap: Record<string, string> = {
    select: 'default', hand: 'grab', rect: 'crosshair',
    ellipse: 'crosshair', line: 'crosshair', arrow: 'crosshair', text: 'text',
  }

  const editingShape = textEdit
    ? (store.shapes.find((s) => s.id === textEdit.id) as TextShape | undefined)
    : null

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0f0f11' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: cursorMap[activeTool] ?? 'default' }}
        aria-label="Design canvas"
      />

      {textEdit && editingShape && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
          <label htmlFor="canvas-text-editor" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            Edit text
          </label>
          <textarea
            id="canvas-text-editor"
            ref={textareaRef}
            defaultValue={editingShape.text}
            title="Edit text. Enter to confirm, Escape to cancel."
            placeholder="Type here…"
            onChange={(e) => store.updateShape(textEdit.id, { text: e.target.value })}
            onBlur={finishTextEdit}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') { e.preventDefault(); finishTextEdit() }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishTextEdit() }
            }}
            style={{
              pointerEvents: 'all',
              position: 'absolute',
              left: textEdit.screenX,
              top: textEdit.screenY,
              minWidth: textEdit.screenW,
              minHeight: textEdit.screenH,
              fontSize: textEdit.fontSize,
              fontWeight: textEdit.fontWeight,
              fontFamily: textEdit.fontFamily,
              fontStyle: textEdit.italic ? 'italic' : 'normal',
              color: textEdit.color,
              background: 'rgba(10,5,25,0.92)',
              border: '2px solid #8b5cf6',
              borderRadius: 4,
              padding: '4px 8px',
              outline: 'none',
              resize: 'both',
              lineHeight: 1.35,
              boxShadow: '0 0 0 4px rgba(139,92,246,0.25)',
              zIndex: 101,
            }}
          />
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: 11, color: '#444', fontFamily: 'DM Mono, monospace', pointerEvents: 'none' }}>
        {Math.round(store.viewport.zoom * 100)}%
      </div>
      <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: '#2a2a35', fontFamily: 'DM Mono, monospace', pointerEvents: 'none' }}>
        {store.showGrid ? 'Grid on' : ''}{store.snapToGrid ? ' · Snap on' : ''}
      </div>
    </div>
  )
}