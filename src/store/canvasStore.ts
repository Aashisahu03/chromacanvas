import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Shape, Tool, CanvasViewport, HistoryEntry, ShapeType } from '@/types'

// ─── Default shape factories ──────────────────────────────────────────────────

export function makeShape(type: ShapeType, x: number, y: number): Shape {
  const base = {
    id: uuidv4(),
    name: type,
    x,
    y,
    opacity: 1,
    locked: false,
    hidden: false,
  }

  const paletteColors = [
    '#6d28d9', '#2563eb', '#0891b2', '#059669',
    '#dc2626', '#d97706', '#be185d', '#7c3aed',
  ]
  const fill = paletteColors[Math.floor(Math.random() * paletteColors.length)]

  switch (type) {
    case 'rect':
      return { ...base, type: 'rect', w: 160, h: 100, fill, stroke: 'none', strokeWidth: 1, cornerRadius: 0 }
    case 'ellipse':
      return { ...base, type: 'ellipse', w: 120, h: 120, fill, stroke: 'none', strokeWidth: 1 }
    case 'line':
      return { ...base, type: 'line', x2: x + 160, y2: y, stroke: '#8b5cf6', strokeWidth: 2 }
    case 'arrow':
      return { ...base, type: 'arrow', x2: x + 160, y2: y, stroke: '#8b5cf6', strokeWidth: 2 }
    case 'text':
      return {
        ...base, type: 'text', w: 200, h: 40, text: 'Double-click to edit',
        fill: '#e2e2e8', fontSize: 18, fontWeight: 400, fontFamily: 'Inter, sans-serif',
        textAlign: 'left', italic: false,
      }
    default:
      return { ...base, type: 'rect', w: 160, h: 100, fill, stroke: 'none', strokeWidth: 1, cornerRadius: 0 }
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface CanvasStore {
  // Shapes
  shapes: Shape[]
  setShapes: (shapes: Shape[]) => void
  addShape: (shape: Shape) => void
  updateShape: (id: string, updates: Partial<Shape>) => void
  deleteShape: (id: string) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  toggleVisibility: (id: string) => void
  toggleLock: (id: string) => void

  // Selection
  selectedIds: string[]
  setSelected: (ids: string[]) => void
  addToSelection: (id: string) => void
  clearSelection: () => void

  // Tool
  activeTool: Tool
  setTool: (tool: Tool) => void
  previousTool: Tool

  // Viewport
  viewport: CanvasViewport
  setViewport: (vp: Partial<CanvasViewport>) => void
  zoomTo: (zoom: number, cx?: number, cy?: number) => void
  zoomFit: () => void
  pan: (dx: number, dy: number) => void

  // Text editing
  editingTextId: string | null
  setEditingText: (id: string | null) => void

  // History
  history: HistoryEntry[]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // UI state
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  toggleGrid: () => void
  toggleSnap: () => void
}

const HISTORY_LIMIT = 60

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // ── Shapes ──
  shapes: [],

  setShapes: (shapes) => set({ shapes }),

  addShape: (shape) => {
    set((s) => ({ shapes: [...s.shapes, shape] }))
    get().pushHistory()
  },

  updateShape: (id, updates) => {
    set((s) => ({
      shapes: s.shapes.map((sh) => sh.id === id ? { ...sh, ...updates } as Shape : sh),
    }))
  },

  deleteShape: (id) => {
    set((s) => ({
      shapes: s.shapes.filter((sh) => sh.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    }))
    get().pushHistory()
  },

  deleteSelected: () => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return
    set((s) => ({
      shapes: s.shapes.filter((sh) => !selectedIds.includes(sh.id)),
      selectedIds: [],
    }))
    get().pushHistory()
  },

  duplicateSelected: () => {
    const { shapes, selectedIds } = get()
    const newShapes: Shape[] = []
    const newIds: string[] = []
    for (const id of selectedIds) {
      const s = shapes.find((sh) => sh.id === id)
      if (!s) continue
      const copy = { ...JSON.parse(JSON.stringify(s)), id: uuidv4(), x: s.x + 20, y: s.y + 20, name: s.name + ' copy' }
      if ('x2' in s) { (copy as { x2: number }).x2 = (s as { x2: number }).x2 + 20; (copy as { y2: number }).y2 = (s as { y2: number }).y2 + 20 }
      newShapes.push(copy as Shape)
      newIds.push(copy.id)
    }
    set((s) => ({ shapes: [...s.shapes, ...newShapes], selectedIds: newIds }))
    get().pushHistory()
  },

  bringToFront: (id) => {
    set((s) => {
      const idx = s.shapes.findIndex((sh) => sh.id === id)
      if (idx < 0) return s
      const arr = [...s.shapes]
      const [item] = arr.splice(idx, 1)
      return { shapes: [...arr, item] }
    })
    get().pushHistory()
  },

  sendToBack: (id) => {
    set((s) => {
      const idx = s.shapes.findIndex((sh) => sh.id === id)
      if (idx < 0) return s
      const arr = [...s.shapes]
      const [item] = arr.splice(idx, 1)
      return { shapes: [item, ...arr] }
    })
    get().pushHistory()
  },

  bringForward: (id) => {
    set((s) => {
      const idx = s.shapes.findIndex((sh) => sh.id === id)
      if (idx < 0 || idx === s.shapes.length - 1) return s
      const arr = [...s.shapes]
      const tmp = arr[idx]; arr[idx] = arr[idx + 1]; arr[idx + 1] = tmp
      return { shapes: arr }
    })
    get().pushHistory()
  },

  sendBackward: (id) => {
    set((s) => {
      const idx = s.shapes.findIndex((sh) => sh.id === id)
      if (idx <= 0) return s
      const arr = [...s.shapes]
      const tmp = arr[idx]; arr[idx] = arr[idx - 1]; arr[idx - 1] = tmp
      return { shapes: arr }
    })
    get().pushHistory()
  },

  toggleVisibility: (id) => {
    set((s) => ({
      shapes: s.shapes.map((sh) => sh.id === id ? { ...sh, hidden: !sh.hidden } : sh),
    }))
  },

  toggleLock: (id) => {
    set((s) => ({
      shapes: s.shapes.map((sh) => sh.id === id ? { ...sh, locked: !sh.locked } : sh),
    }))
  },

  // ── Selection ──
  selectedIds: [],
  setSelected: (ids) => set({ selectedIds: ids }),
  addToSelection: (id) => set((s) => ({ selectedIds: [...new Set([...s.selectedIds, id])] })),
  clearSelection: () => set({ selectedIds: [] }),

  // ── Tool ──
  activeTool: 'select',
  previousTool: 'select',
  setTool: (tool) => set((s) => ({ activeTool: tool, previousTool: s.activeTool })),

  // ── Viewport ──
  viewport: { x: 0, y: 0, zoom: 1 },

  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),

  zoomTo: (zoom, cx = 0, cy = 0) => {
    set((s) => {
      const newZoom = Math.max(0.05, Math.min(20, zoom))
      const scale = newZoom / s.viewport.zoom
      return {
        viewport: {
          zoom: newZoom,
          x: cx - (cx - s.viewport.x) * scale,
          y: cy - (cy - s.viewport.y) * scale,
        },
      }
    })
  },

  zoomFit: () => set({ viewport: { x: 200, y: 100, zoom: 1 } }),

  pan: (dx, dy) => set((s) => ({ viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy } })),

  // ── Text editing ──
  editingTextId: null,
  setEditingText: (id) => set({ editingTextId: id }),

  // ── History ──
  history: [],
  historyIndex: -1,

  pushHistory: () => {
    const { shapes, selectedIds, history, historyIndex } = get()
    const entry: HistoryEntry = { shapes: JSON.parse(JSON.stringify(shapes)), selectedIds: [...selectedIds] }
    const newHistory = [...history.slice(0, historyIndex + 1), entry].slice(-HISTORY_LIMIT)
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex <= 0) return
    const newIdx = historyIndex - 1
    const entry = history[newIdx]
    set({ shapes: JSON.parse(JSON.stringify(entry.shapes)), selectedIds: entry.selectedIds, historyIndex: newIdx })
  },

  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex >= history.length - 1) return
    const newIdx = historyIndex + 1
    const entry = history[newIdx]
    set({ shapes: JSON.parse(JSON.stringify(entry.shapes)), selectedIds: entry.selectedIds, historyIndex: newIdx })
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // ── UI state ──
  showGrid: true,
  snapToGrid: false,
  gridSize: 20,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
}))
