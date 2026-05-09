import type { Shape, HandleName, HandlePoint, CanvasViewport } from '@/types'

// ─── Coordinate transforms ─────────────────────────────────────────────────

export function worldToScreen(wx: number, wy: number, vp: CanvasViewport) {
  return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y }
}

export function screenToWorld(sx: number, sy: number, vp: CanvasViewport) {
  return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom }
}

// ─── Snap to grid ─────────────────────────────────────────────────────────

export function snapValue(val: number, grid: number): number {
  return Math.round(val / grid) * grid
}

export function snapPoint(x: number, y: number, grid: number) {
  return { x: snapValue(x, grid), y: snapValue(y, grid) }
}

// ─── Bounding box ─────────────────────────────────────────────────────────

export function getBoundingBox(shape: Shape) {
  if (shape.type === 'line' || shape.type === 'arrow') {
    const minX = Math.min(shape.x, shape.x2), minY = Math.min(shape.y, shape.y2)
    const maxX = Math.max(shape.x, shape.x2), maxY = Math.max(shape.y, shape.y2)
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }
  if ('w' in shape && 'h' in shape) {
    return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
  }
  const s = shape as { x: number; y: number }

return {
  x: s.x,
  y: s.y,
  w: 0,
  h: 0,
}
}

// ─── Selection handles ────────────────────────────────────────────────────

export function getHandles(shape: Shape): Record<HandleName, HandlePoint> {
  if (shape.type === 'line' || shape.type === 'arrow') {
    return {
      'line-start': { x: shape.x, y: shape.y },
      'line-end': { x: shape.x2, y: shape.y2 },
      nw: { x: 0, y: 0 }, n: { x: 0, y: 0 }, ne: { x: 0, y: 0 },
      e: { x: 0, y: 0 }, se: { x: 0, y: 0 }, s: { x: 0, y: 0 },
      sw: { x: 0, y: 0 }, w: { x: 0, y: 0 },
    }
  }
  const bb = getBoundingBox(shape)
  const { x, y, w, h } = bb
  return {
    nw: { x, y }, n: { x: x + w / 2, y }, ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 }, se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h }, sw: { x, y: y + h }, w: { x, y: y + h / 2 },
    'line-start': { x: 0, y: 0 }, 'line-end': { x: 0, y: 0 },
  }
}

export function getResizeCursor(handle: HandleName): string {
  const map: Partial<Record<HandleName, string>> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
    e: 'e-resize', se: 'se-resize', s: 's-resize',
    sw: 'sw-resize', w: 'w-resize',
    'line-start': 'crosshair', 'line-end': 'crosshair',
  }
  return map[handle] || 'pointer'
}

// ─── Hit testing ──────────────────────────────────────────────────────────

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function hitTestShape(shape: Shape, wx: number, wy: number, zoom: number): boolean {
  if (shape.hidden || shape.locked) return false
  const tolerance = 6 / zoom

  switch (shape.type) {
    case 'rect': {
      return wx >= shape.x && wx <= shape.x + shape.w && wy >= shape.y && wy <= shape.y + shape.h
    }
    case 'ellipse': {
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2
      const rx = Math.abs(shape.w / 2), ry = Math.abs(shape.h / 2)
      if (rx === 0 || ry === 0) return false
      return ((wx - cx) ** 2) / (rx ** 2) + ((wy - cy) ** 2) / (ry ** 2) <= 1
    }
    case 'line':
    case 'arrow': {
      return distToSegment(wx, wy, shape.x, shape.y, shape.x2, shape.y2) < tolerance
    }
    case 'text': {
      return wx >= shape.x && wx <= shape.x + shape.w && wy >= shape.y && wy <= shape.y + shape.h
    }
    default:
      return false
  }
}

export function hitTestHandle(
  shape: Shape,
  cx: number,
  cy: number,
  vp: CanvasViewport
): HandleName | null {
  const handles = getHandles(shape)
  const isLine = shape.type === 'line' || shape.type === 'arrow'
  const checkKeys: HandleName[] = isLine
    ? ['line-start', 'line-end']
    : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  for (const key of checkKeys) {
    const h = handles[key]
    const sc = worldToScreen(h.x, h.y, vp)
    if (Math.hypot(cx - sc.x, cy - sc.y) < 7) return key
  }
  return null
}

// ─── Multi-select bounding box ───────────────────────────────────────────

export function getMultiBoundingBox(shapes: Shape[]) {
  if (shapes.length === 0) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of shapes) {
    const bb = getBoundingBox(s)
    minX = Math.min(minX, bb.x)
    minY = Math.min(minY, bb.y)
    maxX = Math.max(maxX, bb.x + bb.w)
    maxY = Math.max(maxY, bb.y + bb.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// ─── Normalize rect (fix negative w/h after drag-draw) ───────────────────

export function normalizeRect<T extends { x: number; y: number; w: number; h: number }>(s: T): T {
  const result = { ...s }
  if (result.w < 0) { result.x += result.w; result.w = -result.w }
  if (result.h < 0) { result.y += result.h; result.h = -result.h }
  return result
}
