// ─── Shape Types ──────────────────────────────────────────────────────────────

export type ShapeType = 'rect' | 'ellipse' | 'line' | 'text' | 'arrow' | 'image'

export interface BaseShape {
  id: string
  name: string
  type: ShapeType
  x: number
  y: number
  opacity: number
  locked: boolean
  hidden: boolean
  groupId?: string
}

export interface RectShape extends BaseShape {
  type: 'rect'
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse'
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface LineShape extends BaseShape {
  type: 'line'
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
}

export interface ArrowShape extends BaseShape {
  type: 'arrow'
  x2: number
  y2: number
  stroke: string
  strokeWidth: number
}

export interface TextShape extends BaseShape {
  type: 'text'
  w: number
  h: number
  text: string
  fill: string
  fontSize: number
  fontWeight: number
  fontFamily: string
  textAlign: 'left' | 'center' | 'right'
  italic: boolean
}

export interface ImageShape extends BaseShape {
  type: 'image'
  w: number
  h: number
  src: string        // base64 data URL
  originalW: number  // original image dimensions
  originalH: number
  cornerRadius: number
  stroke: string
  strokeWidth: number
  flipX: boolean
  flipY: boolean
}

export type Shape = RectShape | EllipseShape | LineShape | ArrowShape | TextShape | ImageShape

// ─── Tool Types ───────────────────────────────────────────────────────────────

export type Tool = 'select' | 'hand' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text'

// ─── Handle Types ─────────────────────────────────────────────────────────────

export type HandleName = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'line-start' | 'line-end'

export interface HandlePoint {
  x: number
  y: number
}

// ─── Canvas State ─────────────────────────────────────────────────────────────

export interface CanvasViewport {
  x: number    // pan x
  y: number    // pan y
  zoom: number
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  shapes: Shape[]
  selectedIds: string[]
}

// ─── Liveblocks ───────────────────────────────────────────────────────────────

export interface UserPresence {
  cursor: { x: number; y: number } | null
  name: string
  color: string
  selectedId: string | null
}

export interface LiveStorage {
  shapes: Shape[]
}