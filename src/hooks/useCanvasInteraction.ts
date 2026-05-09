import { useRef, useEffect, useCallback } from 'react'
import { useCanvasStore, makeShape } from '@/store/canvasStore'
import {
  screenToWorld, hitTestShape, hitTestHandle,
  getResizeCursor, normalizeRect, snapPoint,
} from '@/utils/canvasGeometry'
import type { Shape, HandleName } from '@/types'

interface InteractionState {
  mode: 'idle' | 'panning' | 'drawing' | 'dragging' | 'resizing' | 'rubber-band'
  panStart: { cx: number; cy: number; vpx: number; vpy: number } | null
  drawStart: { wx: number; wy: number } | null
  dragStart: { wx: number; wy: number } | null
  dragOffsets: Map<string, { dx: number; dy: number }>
  resizeHandle: HandleName | null
  resizeShapeSnapshot: Shape | null
  rubberStart: { cx: number; cy: number } | null
  spaceDown: boolean
}

export function useCanvasInteraction(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const store = useCanvasStore()
  const state = useRef<InteractionState>({
    mode: 'idle',
    panStart: null,
    drawStart: null,
    dragStart: null,
    dragOffsets: new Map(),
    resizeHandle: null,
    resizeShapeSnapshot: null,
    rubberStart: null,
    spaceDown: false,
  })

  const getCanvasXY = useCallback((e: MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { cx: e.clientX - rect.left, cy: e.clientY - rect.top }
  }, [canvasRef])

  const snap = useCallback((wx: number, wy: number) => {
    const { snapToGrid, gridSize } = store
    return snapToGrid ? snapPoint(wx, wy, gridSize) : { x: wx, y: wy }
  }, [store])

  // ── Mouse Down ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return
    const { cx, cy } = getCanvasXY(e)
    const { viewport, activeTool, shapes, selectedIds, setSelected, clearSelection, setTool, snapToGrid, gridSize } = store
    const w = screenToWorld(cx, cy, viewport)
    const s = state.current

    // Space + drag = pan
    if (s.spaceDown || activeTool === 'hand') {
      s.mode = 'panning'
      s.panStart = { cx, cy, vpx: viewport.x, vpy: viewport.y }
      return
    }

    // Text tool
    if (activeTool === 'text') {
      const snapped = snapToGrid ? snapPoint(w.x, w.y, gridSize) : w
      const shape = makeShape('text', snapped.x, snapped.y)
      store.addShape(shape)
      store.setSelected([shape.id])
      store.setEditingText(shape.id)
      setTool('select')
      return
    }

    // Select tool
    if (activeTool === 'select') {
      // Check handles on selected shape
      if (selectedIds.length === 1) {
        const sel = shapes.find((sh) => sh.id === selectedIds[0])
        if (sel) {
          const handle = hitTestHandle(sel, cx, cy, viewport)
          if (handle) {
            s.mode = 'resizing'
            s.resizeHandle = handle
            s.resizeShapeSnapshot = JSON.parse(JSON.stringify(sel))
            s.drawStart = { wx: w.x, wy: w.y }
            return
          }
        }
      }

      // Hit test shapes (top-down)
      let hit: Shape | null = null
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitTestShape(shapes[i], w.x, w.y, viewport.zoom)) { hit = shapes[i]; break }
      }

      if (hit) {
        if (e.shiftKey) {
          // Multi-select toggle
          if (selectedIds.includes(hit.id)) {
            setSelected(selectedIds.filter((id) => id !== hit!.id))
          } else {
            store.addToSelection(hit.id)
          }
        } else {
          if (!selectedIds.includes(hit.id)) setSelected([hit.id])
        }
        // Set up drag
        s.mode = 'dragging'
        s.dragStart = { wx: w.x, wy: w.y }
        s.dragOffsets.clear()
        const currentIds = e.shiftKey ? store.selectedIds : selectedIds.includes(hit.id) ? selectedIds : [hit.id]
        for (const id of currentIds) {
          const sh = shapes.find((x) => x.id === id)
          if (!sh || sh.locked) continue
          const isLine = sh.type === 'line' || sh.type === 'arrow'
          if (isLine) {
            s.dragOffsets.set(id, { dx: w.x - sh.x, dy: w.y - sh.y })
          } else {
            s.dragOffsets.set(id, { dx: w.x - sh.x, dy: w.y - sh.y })
          }
        }
      } else {
        if (!e.shiftKey) clearSelection()
        // Rubber band
        s.mode = 'rubber-band'
        s.rubberStart = { cx, cy }
        store.setViewport({ rubberBand: null } as never)
      }
      return
    }

    // Drawing tools
    const snapped = snap(w.x, w.y)
    s.mode = 'drawing'
    s.drawStart = { wx: snapped.x, wy: snapped.y }

    const preview = makeShape(activeTool as Shape['type'], snapped.x, snapped.y)
    if (activeTool === 'line' || activeTool === 'arrow') {
      store.setViewport({ _preview: preview } as never)
    } else {
      ;(preview as { w: number }).w = 0;
      ;(preview as { h: number }).h = 0
    }
    store.setViewport({ _preview: preview } as never)
  }, [getCanvasXY, store, snap])

  // ── Mouse Move ────────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e: MouseEvent) => {
    const { cx, cy } = getCanvasXY(e)
    const { viewport, activeTool, shapes, selectedIds, updateShape } = store
    const w = screenToWorld(cx, cy, viewport)
    const s = state.current
    const canvas = canvasRef.current!

    if (s.mode === 'panning' && s.panStart) {
      store.setViewport({ x: s.panStart.vpx + (cx - s.panStart.cx), y: s.panStart.vpy + (cy - s.panStart.cy) })
      return
    }

    if (s.mode === 'drawing' && s.drawStart) {
      const snapped = snap(w.x, w.y)
      store.setViewport({ _drawPreview: { x: s.drawStart.wx, y: s.drawStart.wy, x2: snapped.x, y2: snapped.y, wx2: snapped.x, wy2: snapped.y } } as never)
      return
    }

    if (s.mode === 'dragging' && s.dragStart) {
      const snapped = snap(w.x, w.y)
      for (const [id, offset] of s.dragOffsets) {
        const sh = shapes.find((x) => x.id === id)
        if (!sh || sh.locked) continue
        const isLine = sh.type === 'line' || sh.type === 'arrow'
        const nx = snapped.x - offset.dx, ny = snapped.y - offset.dy
        if (isLine) {
          const lineSh = sh as { x: number; y: number; x2: number; y2: number }
          const origDx = lineSh.x2 - lineSh.x, origDy = lineSh.y2 - lineSh.y
          updateShape(id, { x: nx, y: ny, x2: nx + origDx, y2: ny + origDy } as Partial<Shape>)
        } else {
          updateShape(id, { x: nx, y: ny })
        }
      }
      return
    }

    if (s.mode === 'resizing' && s.resizeShapeSnapshot && s.resizeHandle && s.drawStart) {
      const snap2 = snap(w.x, w.y)
      const orig = s.resizeShapeSnapshot
      const dx = snap2.x - s.drawStart.wx, dy = snap2.y - s.drawStart.wy
      const id = selectedIds[0]

      if (orig.type === 'line' || orig.type === 'arrow') {
        if (s.resizeHandle === 'line-start') updateShape(id, { x: snap2.x, y: snap2.y } as Partial<Shape>)
        else updateShape(id, { x2: snap2.x, y2: snap2.y } as Partial<Shape>)
        return
      }

      if (!('w' in orig)) return
      let nx = orig.x, ny = orig.y, nw = orig.w, nh = orig.h
      const h = s.resizeHandle
      if (h.includes('e')) nw = Math.max(4, orig.w + dx)
      if (h.includes('s')) nh = Math.max(4, orig.h + dy)
      if (h.includes('w')) { nx = orig.x + dx; nw = Math.max(4, orig.w - dx) }
      if (h.includes('n')) { ny = orig.y + dy; nh = Math.max(4, orig.h - dy) }
      // Shift = maintain aspect ratio
      if (e.shiftKey && 'w' in orig && orig.w > 0 && orig.h > 0) {
        const ratio = orig.w / orig.h
        if (Math.abs(dx) > Math.abs(dy)) nh = nw / ratio
        else nw = nh * ratio
      }
      updateShape(id, { x: nx, y: ny, w: nw, h: nh } as Partial<Shape>)
      return
    }

    if (s.mode === 'rubber-band') return

    // Cursor update for idle
    if (activeTool === 'select') {
      if (selectedIds.length === 1) {
        const sel = shapes.find((sh) => sh.id === selectedIds[0])
        if (sel) {
          const handle = hitTestHandle(sel, cx, cy, viewport)
          if (handle) { canvas.style.cursor = getResizeCursor(handle); return }
        }
      }
      let hit = false
      for (let i = shapes.length - 1; i >= 0; i--) {
        if (hitTestShape(shapes[i], w.x, w.y, viewport.zoom)) { hit = true; break }
      }
      canvas.style.cursor = hit ? 'move' : 'default'
    } else if (activeTool === 'hand' || s.spaceDown) {
      canvas.style.cursor = 'grab'
    } else {
      canvas.style.cursor = 'crosshair'
    }
  }, [getCanvasXY, store, snap, canvasRef])

  // ── Mouse Up ──────────────────────────────────────────────────────────────
  const onMouseUp = useCallback((e: MouseEvent) => {
    const { cx, cy } = getCanvasXY(e)
    const { viewport, activeTool, shapes, setSelected } = store
    const w = screenToWorld(cx, cy, viewport)
    const s = state.current

    if (s.mode === 'panning') { s.mode = 'idle'; s.panStart = null; return }

    if (s.mode === 'dragging') {
      s.mode = 'idle'; s.dragStart = null; s.dragOffsets.clear()
      store.pushHistory(); return
    }

    if (s.mode === 'resizing') {
      s.mode = 'idle'; s.resizeHandle = null; s.resizeShapeSnapshot = null; s.drawStart = null
      store.pushHistory(); return
    }

    if (s.mode === 'rubber-band' && s.rubberStart) {
      const startW = screenToWorld(s.rubberStart.cx, s.rubberStart.cy, viewport)
      const endW = w
      const rx = Math.min(startW.x, endW.x), ry = Math.min(startW.y, endW.y)
      const rw = Math.abs(endW.x - startW.x), rh = Math.abs(endW.y - startW.y)
      if (rw > 4 && rh > 4) {
        const hits = shapes.filter((sh) => {
          if (sh.hidden || sh.locked) return false
          const isLine = sh.type === 'line' || sh.type === 'arrow'
          if (isLine) {
            return (sh as { x: number }).x >= rx && (sh as { x2: number }).x2 <= rx + rw &&
              (sh as { y: number }).y >= ry && (sh as { y2: number }).y2 <= ry + rh
          }
          return 'x' in sh && 'w' in sh &&
            sh.x >= rx && sh.x + (sh as { w: number }).w <= rx + rw &&
            sh.y >= ry && sh.y + (sh as { h: number }).h <= ry + rh
        })
        setSelected(hits.map((sh) => sh.id))
      }
      s.mode = 'idle'; s.rubberStart = null
      return
    }

    if (s.mode === 'drawing' && s.drawStart) {
      const snapped = snap(w.x, w.y)
      s.mode = 'idle'

      if (activeTool === 'line' || activeTool === 'arrow') {
        const len = Math.hypot(snapped.x - s.drawStart.wx, snapped.y - s.drawStart.wy)
        if (len < 4) { s.drawStart = null; return }
        const shape = makeShape(activeTool, s.drawStart.wx, s.drawStart.wy)
        ;(shape as { x2: number }).x2 = snapped.x
        ;(shape as { y2: number }).y2 = snapped.y
        store.addShape(shape)
        setSelected([shape.id])
      } else {
        let nx = s.drawStart.wx, ny = s.drawStart.wy
        let nw = snapped.x - nx, nh = snapped.y - ny
        if (Math.abs(nw) < 4 && Math.abs(nh) < 4) { s.drawStart = null; return }
        if (e.shiftKey) { const size = Math.max(Math.abs(nw), Math.abs(nh)); nw = Math.sign(nw) * size; nh = Math.sign(nh) * size }
        const shape = makeShape(activeTool as Shape['type'], nx, ny)
        ;(shape as { w: number }).w = nw
        ;(shape as { h: number }).h = nh
        const normalized = normalizeRect({ ...shape, w: nw, h: nh, x: nx, y: ny })
        Object.assign(shape, normalized)
        store.addShape(shape)
        setSelected([shape.id])
      }

      s.drawStart = null
      store.setTool('select')
    }
  }, [getCanvasXY, store, snap])

  // ── Scroll / Zoom ─────────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const { cx, cy } = getCanvasXY(e as unknown as MouseEvent)
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      store.zoomTo(store.viewport.zoom * factor, cx, cy)
    } else {
      store.pan(-e.deltaX, -e.deltaY)
    }
  }, [getCanvasXY, store])

  // ── Space key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !state.current.spaceDown) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        state.current.spaceDown = true
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        state.current.spaceDown = false
        if (state.current.mode === 'panning') { state.current.mode = 'idle'; state.current.panStart = null }
        if (canvasRef.current) canvasRef.current.style.cursor = ''
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [canvasRef])

  // ── Context menu ──────────────────────────────────────────────────────────
  const onContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    const { cx, cy } = getCanvasXY(e)
    const { viewport, shapes, setSelected } = store
    const w = screenToWorld(cx, cy, viewport)
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestShape(shapes[i], w.x, w.y, viewport.zoom)) {
        setSelected([shapes[i].id])
        break
      }
    }
  }, [getCanvasXY, store])

  // ── Attach events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [canvasRef, onMouseDown, onMouseMove, onMouseUp, onWheel, onContextMenu])

  return state
}
