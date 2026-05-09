import type { Shape, CanvasViewport, ImageShape } from '@/types'
import { getHandles, worldToScreen } from './canvasGeometry'
import { getCachedImage } from './imageCache'
// ─── Grid ─────────────────────────────────────────────────────────────────

export function drawGrid(ctx: CanvasRenderingContext2D, vp: CanvasViewport, w: number, h: number) {
  const gridSize = 20 * vp.zoom
  if (gridSize < 6) return

  const ox = vp.x % gridSize
  const oy = vp.y % gridSize

  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let x = ox; x < w; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
  for (let y = oy; y < h; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()

  // Major grid every 5 cells
  const major = gridSize * 5
  const mox = vp.x % major
  const moy = vp.y % major
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  for (let x = mox; x < w; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
  for (let y = moy; y < h; y += major) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
  ctx.stroke()
}

// ─── Individual shape renderer ────────────────────────────────────────────

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.globalAlpha = shape.opacity ?? 1

  switch (shape.type) {
    case 'rect': {
      const { x, y, w, h, fill, stroke, strokeWidth, cornerRadius } = shape
      if (w === 0 || h === 0) break
      ctx.beginPath()
      if (cornerRadius > 0) {
        const r = Math.min(cornerRadius, w / 2, h / 2)
        ctx.roundRect(x, y, w, h, r)
      } else {
        ctx.rect(x, y, w, h)
      }
      if (fill !== 'none') { ctx.fillStyle = fill; ctx.fill() }
      if (stroke !== 'none' && strokeWidth > 0) {
        ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.stroke()
      }
      break
    }

    case 'ellipse': {
      const { x, y, w, h, fill, stroke, strokeWidth } = shape
      if (w === 0 || h === 0) break
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2)
      if (fill !== 'none') { ctx.fillStyle = fill; ctx.fill() }
      if (stroke !== 'none' && strokeWidth > 0) {
        ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.stroke()
      }
      break
    }

    case 'line': {
      const { x, y, x2, y2, stroke, strokeWidth } = shape
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2)
      ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth
      ctx.lineCap = 'round'
      ctx.stroke()
      break
    }

    case 'arrow': {
      const { x, y, x2, y2, stroke, strokeWidth } = shape
      const angle = Math.atan2(y2 - y, x2 - x)
      const headLen = Math.max(12, strokeWidth * 4)

      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2)
      ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth
      ctx.lineCap = 'round'
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      )
      ctx.moveTo(x2, y2)
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      )
      ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth
      ctx.stroke()
      break
    }

    case 'image': {
      const is = shape as ImageShape
      if (is.w === 0 || is.h === 0) break
      const img = getCachedImage(is.src)
      if (img) {
        ctx.save()
        if (is.cornerRadius > 0) {
          ctx.beginPath()
          const r = Math.min(is.cornerRadius, is.w / 2, is.h / 2)
          ctx.roundRect(is.x, is.y, is.w, is.h, r)
          ctx.clip()
        }
        if (is.flipX || is.flipY) {
          ctx.translate(is.flipX ? is.x + is.w : is.x, is.flipY ? is.y + is.h : is.y)
          ctx.scale(is.flipX ? -1 : 1, is.flipY ? -1 : 1)
          ctx.drawImage(img, 0, 0, is.flipX ? is.w : is.w, is.flipY ? is.h : is.h)
        } else {
          ctx.drawImage(img, is.x, is.y, is.w, is.h)
        }
        ctx.restore()
        if (is.stroke !== 'none' && is.strokeWidth > 0) {
          if (is.cornerRadius > 0) {
            ctx.beginPath()
            ctx.roundRect(is.x, is.y, is.w, is.h, Math.min(is.cornerRadius, is.w / 2, is.h / 2))
            ctx.strokeStyle = is.stroke; ctx.lineWidth = is.strokeWidth; ctx.stroke()
          } else {
            ctx.strokeStyle = is.stroke; ctx.lineWidth = is.strokeWidth
            ctx.strokeRect(is.x, is.y, is.w, is.h)
          }
        }
      } else {
        // Placeholder while loading
        ctx.fillStyle = '#1e1e26'
        ctx.fillRect(is.x, is.y, is.w, is.h)
        ctx.fillStyle = '#555'
        ctx.font = '12px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Loading…', is.x + is.w/2, is.y + is.h/2)
      }
      break
    }

    case 'text': {
      const { x, y, w, text, fill, fontSize, fontWeight, fontFamily, textAlign, italic } = shape
      if (!text) break
      const fontStyle = italic ? 'italic ' : ''
      ctx.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`
      ctx.fillStyle = fill
      ctx.textAlign = textAlign || 'left'
      const lines = text.split('\n')
      const lineH = fontSize * 1.35
      lines.forEach((line, i) => {
        const tx = textAlign === 'center' ? x + w / 2 : textAlign === 'right' ? x + w : x
        ctx.fillText(line, tx, y + fontSize + i * lineH)
      })
      break
    }
  }

  ctx.globalAlpha = 1
}

// ─── Selection outline ────────────────────────────────────────────────────

export function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  vp: CanvasViewport,
  color = '#8b5cf6'
) {
  ctx.save()
  ctx.translate(vp.x, vp.y)
  ctx.scale(vp.zoom, vp.zoom)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5 / vp.zoom
  ctx.setLineDash([5 / vp.zoom, 3 / vp.zoom])

  if (shape.type === 'line' || shape.type === 'arrow') {
    ctx.beginPath(); ctx.moveTo(shape.x, shape.y); ctx.lineTo(shape.x2, shape.y2); ctx.stroke()
  } else if ('w' in shape) {
    ctx.strokeRect(shape.x - 1 / vp.zoom, shape.y - 1 / vp.zoom, shape.w + 2 / vp.zoom, shape.h + 2 / vp.zoom)
  }

  ctx.setLineDash([])
  ctx.restore()

  // Handles
  const isLine = shape.type === 'line' || shape.type === 'arrow'
  const handles = getHandles(shape)
  const keys = isLine ? ['line-start', 'line-end'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  for (const key of keys as (keyof typeof handles)[]) {
    const h = handles[key]
    const sc = worldToScreen(h.x, h.y, vp)
    ctx.beginPath()
    ctx.arc(sc.x, sc.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
    ctx.strokeStyle = '#0f0f11'; ctx.lineWidth = 1.5; ctx.stroke()
  }
}

// ─── Multi-select bounding box ───────────────────────────────────────────

export function drawMultiSelectBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  vp: CanvasViewport
) {
  const s = worldToScreen(x, y, vp)
  const sw = w * vp.zoom, sh = h * vp.zoom
  ctx.strokeStyle = '#8b5cf6'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 3])
  ctx.strokeRect(s.x - 4, s.y - 4, sw + 8, sh + 8)
  ctx.setLineDash([])
}

// ─── Rubber-band selection rect ───────────────────────────────────────────

export function drawRubberBand(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  ctx.fillStyle = 'rgba(139,92,246,0.08)'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(139,92,246,0.6)'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, w, h)
}

// ─── Draw preview (while dragging to create) ─────────────────────────────

export function drawPreviewShape(ctx: CanvasRenderingContext2D, shape: Shape, vp: CanvasViewport) {
  ctx.save()
  ctx.translate(vp.x, vp.y)
  ctx.scale(vp.zoom, vp.zoom)
  ctx.globalAlpha = 0.7
  drawShape(ctx, shape)
  ctx.restore()
}

// ─── Cursor crosshairs for tools ──────────────────────────────────────────

export function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const size = 8
  ctx.strokeStyle = 'rgba(139,92,246,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x - size, y); ctx.lineTo(x + size, y)
  ctx.moveTo(x, y - size); ctx.lineTo(x, y + size)
  ctx.stroke()
}

// ─── Alignment guides ─────────────────────────────────────────────────────

export function drawAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  guides: Array<{ type: 'h' | 'v'; pos: number }>,
  vp: CanvasViewport,
  canvasW: number,
  canvasH: number
) {
  ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])

  for (const g of guides) {
    if (g.type === 'h') {
      const sy = g.pos * vp.zoom + vp.y
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(canvasW, sy); ctx.stroke()
    } else {
      const sx = g.pos * vp.zoom + vp.x
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, canvasH); ctx.stroke()
    }
  }
  ctx.setLineDash([])
}