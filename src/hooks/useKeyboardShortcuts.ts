import { useEffect } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { downloadSVG } from '@/utils/exportUtils'

export function useKeyboardShortcuts() {
  const store = useCanvasStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable
      if (isInput) return

      const ctrl = e.ctrlKey || e.metaKey

      // ── Undo / Redo ──
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); return }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); return }

      // ── Duplicate / Delete ──
      if (ctrl && e.key === 'd') { e.preventDefault(); store.duplicateSelected(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { store.deleteSelected(); return }

      // ── Tools ──
      const toolMap: Record<string, Parameters<typeof store.setTool>[0]> = {
        v: 'select', h: 'hand', r: 'rect', e: 'ellipse',
        l: 'line', a: 'arrow', t: 'text',
      }
      if (!ctrl && toolMap[e.key.toLowerCase()]) {
        store.setTool(toolMap[e.key.toLowerCase()])
        return
      }

      // ── Escape ──
      if (e.key === 'Escape') {
        store.clearSelection()
        store.setTool('select')
        store.setEditingText(null)
        return
      }

      // ── Zoom ──
      if (e.key === '0') { e.preventDefault(); store.zoomFit(); return }
      if (ctrl && e.key === '=') { e.preventDefault(); store.zoomTo(store.viewport.zoom * 1.2); return }
      if (ctrl && e.key === '-') { e.preventDefault(); store.zoomTo(store.viewport.zoom / 1.2); return }

      // ── Layer order ──
      if (ctrl && e.key === ']') {
        e.preventDefault()
        store.selectedIds.forEach((id) => store.bringForward(id))
        return
      }
      if (ctrl && e.key === '[') {
        e.preventDefault()
        store.selectedIds.forEach((id) => store.sendBackward(id))
        return
      }
      if (ctrl && e.shiftKey && e.key === ']') {
        e.preventDefault()
        store.selectedIds.forEach((id) => store.bringToFront(id))
        return
      }
      if (ctrl && e.shiftKey && e.key === '[') {
        e.preventDefault()
        store.selectedIds.forEach((id) => store.sendToBack(id))
        return
      }

      // ── Select All ──
      if (ctrl && e.key === 'a') {
        e.preventDefault()
        store.setSelected(store.shapes.filter((s) => !s.hidden && !s.locked).map((s) => s.id))
        return
      }

      // ── Export SVG ──
      if (ctrl && e.shiftKey && e.key === 'E') {
        e.preventDefault()
        downloadSVG(store.shapes)
        return
      }

      // ── Grid / Snap ──
      if (ctrl && e.key === "'") { e.preventDefault(); store.toggleGrid(); return }
      if (ctrl && e.shiftKey && e.key === "'") { e.preventDefault(); store.toggleSnap(); return }

      // ── Arrow nudge ──
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const delta = e.shiftKey ? 10 : 1
        const { selectedIds, shapes, updateShape } = store
        if (selectedIds.length === 0) return
        e.preventDefault()
        for (const id of selectedIds) {
          const s = shapes.find((sh) => sh.id === id)
          if (!s || s.locked) continue
          const isLine = s.type === 'line' || s.type === 'arrow'
          const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0
          const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0
          if (isLine) {
            updateShape(id, { x: s.x + dx, y: s.y + dy, x2: (s as { x2: number }).x2 + dx, y2: (s as { y2: number }).y2 + dy } as Partial<typeof s>)
          } else {
            updateShape(id, { x: s.x + dx, y: s.y + dy })
          }
        }
        store.pushHistory()
        return
      }

      // ── Space to pan (handled in canvas via spaceDown state) ──
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [store])
}
