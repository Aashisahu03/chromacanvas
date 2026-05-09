import { useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { v4 as uuidv4 } from 'uuid'
import type { Shape } from '@/types'
import styles from './PatternPanel.module.css'

type PatternType = 'grid' | 'spiral' | 'fibonacci' | 'radial' | 'wave' | 'noise' | 'honeycomb' | 'scatter'
type ShapeKind = 'rect' | 'ellipse'

interface PatternConfig {
  type: PatternType
  shapeKind: ShapeKind
  count: number
  size: number
  spacing: number
  colorA: string
  colorB: string
  opacity: number
  rotate: boolean
  scaleVariance: number
}

// ── Math helpers ──────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function lerpColor(a: string, b: string, t: number): string {
  const ah = a.replace('#', ''), bh = b.replace('#', '')
  const ar = parseInt(ah.slice(0,2),16), ag = parseInt(ah.slice(2,4),16), ab = parseInt(ah.slice(4,6),16)
  const br = parseInt(bh.slice(0,2),16), bg = parseInt(bh.slice(2,4),16), bb = parseInt(bh.slice(4,6),16)
  const rr = Math.round(lerp(ar,br,t)), rg = Math.round(lerp(ag,bg,t)), rb = Math.round(lerp(ab,bb,t))
  return `#${rr.toString(16).padStart(2,'0')}${rg.toString(16).padStart(2,'0')}${rb.toString(16).padStart(2,'0')}`
}
function noise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

// ── Pattern generators ────────────────────────────────────────────────────────
type Point = { x: number; y: number; t: number; angle: number; scale: number }

function generateGrid(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const cols = Math.ceil(Math.sqrt(cfg.count))
  const rows = Math.ceil(cfg.count / cols)
  const gap = cfg.size + cfg.spacing
  const startX = cx - (cols * gap) / 2
  const startY = cy - (rows * gap) / 2
  const points: Point[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (points.length >= cfg.count) break
      const t = points.length / cfg.count
      points.push({ x: startX + c * gap, y: startY + r * gap, t, angle: cfg.rotate ? t * Math.PI * 2 : 0, scale: 1 + (noise(c, r) - 0.5) * cfg.scaleVariance })
    }
  return points
}
function generateSpiral(cfg: PatternConfig, cx: number, cy: number): Point[] {
  return Array.from({ length: cfg.count }, (_, i) => {
    const t = i / cfg.count, angle = t * Math.PI * 2 * 6
    const radius = t * (cfg.count * (cfg.size + cfg.spacing) * 0.08)
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, t, angle: cfg.rotate ? angle : 0, scale: 1 + (noise(i, 0) - 0.5) * cfg.scaleVariance }
  })
}
function generateFibonacci(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const goldenAngle = Math.PI * 2 * (2 - (1 + Math.sqrt(5)) / 2)
  return Array.from({ length: cfg.count }, (_, i) => {
    const t = i / cfg.count, angle = i * goldenAngle
    return { x: cx + Math.cos(angle) * Math.sqrt(i) * (cfg.size + cfg.spacing) * 0.55, y: cy + Math.sin(angle) * Math.sqrt(i) * (cfg.size + cfg.spacing) * 0.55, t, angle: cfg.rotate ? angle : 0, scale: 0.4 + t * 0.8 + (noise(i, 1) - 0.5) * cfg.scaleVariance }
  })
}
function generateRadial(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const rings = Math.ceil(Math.sqrt(cfg.count / Math.PI)), points: Point[] = []
  for (let ring = 1; ring <= rings && points.length < cfg.count; ring++)
    for (let j = 0; j < Math.round(6 * ring) && points.length < cfg.count; j++) {
      const angle = (j / Math.round(6 * ring)) * Math.PI * 2, t = points.length / cfg.count
      points.push({ x: cx + Math.cos(angle) * ring * (cfg.size + cfg.spacing) * 1.1, y: cy + Math.sin(angle) * ring * (cfg.size + cfg.spacing) * 1.1, t, angle: cfg.rotate ? angle + Math.PI / 2 : 0, scale: 1 + (noise(ring, j) - 0.5) * cfg.scaleVariance })
    }
  return points
}
function generateWave(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const gap = cfg.size + cfg.spacing, startX = cx - (cfg.count * gap) / 2, points: Point[] = []
  for (let i = 0; i < cfg.count && points.length < cfg.count; i++) {
    const t = i / cfg.count, x = startX + i * gap
    points.push({ x, y: cy + Math.sin(t * Math.PI * 6) * (cfg.size * 3), t, angle: cfg.rotate ? Math.sin(t * Math.PI * 6) * 0.5 : 0, scale: 0.6 + Math.abs(Math.sin(t * Math.PI * 3)) * 0.8 })
    if (points.length < cfg.count)
      points.push({ x, y: cy + Math.sin(t * Math.PI * 6 + 1) * (cfg.size * 5), t: 1 - t, angle: cfg.rotate ? Math.cos(t * Math.PI * 6) * 0.5 : 0, scale: 0.4 + Math.abs(Math.cos(t * Math.PI * 3)) * 0.6 })
  }
  return points.slice(0, cfg.count)
}
function generateHoneycomb(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const gap = cfg.size + cfg.spacing, cols = Math.ceil(Math.sqrt(cfg.count)), rows = Math.ceil(cfg.count / cols)
  const startX = cx - (cols * gap) / 2, startY = cy - (rows * gap * 0.866) / 2, points: Point[] = []
  for (let r = 0; r < rows && points.length < cfg.count; r++)
    for (let c = 0; c < cols && points.length < cfg.count; c++) {
      const t = points.length / cfg.count
      points.push({ x: startX + c * gap + (r % 2 === 0 ? 0 : gap * 0.5), y: startY + r * gap * 0.866, t, angle: cfg.rotate ? Math.PI / 6 : 0, scale: 1 + (noise(c * 1.3, r * 2.7) - 0.5) * cfg.scaleVariance })
    }
  return points
}
function generateNoise(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const spread = Math.sqrt(cfg.count) * (cfg.size + cfg.spacing) * 0.8
  return Array.from({ length: cfg.count }, (_, i) => {
    const t = i / cfg.count
    return { x: cx + (noise(i * 0.1, 0) * 2 - 1 + (noise(i * 0.1 + 5, 3) * 2 - 1) * 0.5) * spread, y: cy + (noise(0, i * 0.1) * 2 - 1 + (noise(7, i * 0.1 + 5) * 2 - 1) * 0.5) * spread, t, angle: cfg.rotate ? noise(i, i) * Math.PI * 2 : 0, scale: 0.3 + noise(i * 0.3, i * 0.7) * cfg.scaleVariance + 0.5 }
  })
}
function generateScatter(cfg: PatternConfig, cx: number, cy: number): Point[] {
  const spread = Math.sqrt(cfg.count) * (cfg.size + cfg.spacing) * 0.6
  return Array.from({ length: cfg.count }, (_, i) => {
    const t = i / cfg.count, angle = noise(i, 0) * Math.PI * 2, r = Math.sqrt(noise(0, i)) * spread
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, t, angle: cfg.rotate ? noise(i * 2, i * 3) * Math.PI * 2 : 0, scale: 0.2 + noise(i * 0.5, i * 1.3) * (0.8 + cfg.scaleVariance) }
  })
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PATTERNS: { id: PatternType; icon: string; label: string }[] = [
  { id: 'grid',      icon: '⊞', label: 'Grid'      },
  { id: 'spiral',    icon: '🌀', label: 'Spiral'    },
  { id: 'fibonacci', icon: '🌸', label: 'Fibonacci' },
  { id: 'radial',    icon: '✳',  label: 'Radial'    },
  { id: 'wave',      icon: '〰', label: 'Wave'      },
  { id: 'honeycomb', icon: '⬡', label: 'Honeycomb' },
  { id: 'noise',     icon: '☁', label: 'Noise'     },
  { id: 'scatter',   icon: '·',  label: 'Scatter'   },
]

const SLIDERS = [
  { label: 'Count',        key: 'count'        as const, min: 10,  max: 300, step: 5,    fmt: (v: number) => String(v) },
  { label: 'Size',         key: 'size'         as const, min: 4,   max: 60,  step: 1,    fmt: (v: number) => `${v}px` },
  { label: 'Spacing',      key: 'spacing'      as const, min: 0,   max: 40,  step: 1,    fmt: (v: number) => `${v}px` },
  { label: 'Opacity',      key: 'opacity'      as const, min: 0.1, max: 1,   step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
  { label: 'Size Variance',key: 'scaleVariance'as const, min: 0,   max: 2,   step: 0.1,  fmt: (v: number) => v.toFixed(1) },
] as const

// ── Component ─────────────────────────────────────────────────────────────────
export default function PatternPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { addShape, setSelected, pushHistory, viewport } = useCanvasStore()

  const [cfg, setCfg] = useState<PatternConfig>({
    type: 'fibonacci', shapeKind: 'ellipse',
    count: 80, size: 14, spacing: 4,
    colorA: '#7c3aed', colorB: '#06b6d4',
    opacity: 0.85, rotate: true, scaleVariance: 0.5,
  })

  const set = <K extends keyof PatternConfig>(key: K, val: PatternConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: val }))

  const generate = useCallback(() => {
    setGenerating(true)
    setTimeout(() => {
      const cx = (-viewport.x + window.innerWidth * 0.5) / viewport.zoom
      const cy = (-viewport.y + window.innerHeight * 0.5) / viewport.zoom
      const generators: Record<PatternType, (c: PatternConfig, cx: number, cy: number) => Point[]> = {
        grid: generateGrid, spiral: generateSpiral, fibonacci: generateFibonacci,
        radial: generateRadial, wave: generateWave, honeycomb: generateHoneycomb,
        noise: generateNoise, scatter: generateScatter,
      }
      const points = generators[cfg.type](cfg, cx, cy)
      const newIds: string[] = []
      for (const pt of points) {
        const id = uuidv4()
        const s = cfg.size * Math.max(0.1, pt.scale)
        const color = lerpColor(cfg.colorA, cfg.colorB, pt.t)
        const base = { id, name: `${cfg.type}-${newIds.length}`, x: pt.x - s / 2, y: pt.y - s / 2, opacity: cfg.opacity * (0.5 + pt.t * 0.5), locked: false, hidden: false }
        const shape: Shape = cfg.shapeKind === 'ellipse'
          ? { ...base, type: 'ellipse', w: s, h: s, fill: color, stroke: 'none', strokeWidth: 0 } as Shape
          : { ...base, type: 'rect', w: s, h: s, fill: color, stroke: 'none', strokeWidth: 0, cornerRadius: s * 0.15 } as Shape
        addShape(shape)
        newIds.push(id)
      }
      setSelected(newIds)
      pushHistory()
      setGenerating(false)
    }, 10)
  }, [cfg, viewport, addShape, setSelected, pushHistory])

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} title="Pattern Generator" className={styles.fab}>
        ✳
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>✳</span>
          <span className={styles.headerTitle}>Pattern Generator</span>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className={styles.closeBtn} aria-label="Close pattern panel">×</button>
      </div>

      <div className={styles.body}>
        {/* Pattern type */}
        <div>
          <div className={styles.sectionLabel}>Pattern</div>
          <div className={styles.patternGrid}>
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => set('type', p.id)}
                className={`${styles.patternBtn} ${cfg.type === p.id ? styles.active : ''}`}
                title={p.label}
              >
                <span className={styles.patternBtnIcon}>{p.icon}</span>
                <span className={styles.patternBtnLabel}>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Shape kind */}
        <div>
          <div className={styles.sectionLabel}>Shape</div>
          <div className={styles.shapeRow}>
            {(['ellipse', 'rect'] as ShapeKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set('shapeKind', k)}
                className={`${styles.shapeBtn} ${cfg.shapeKind === k ? styles.active : ''}`}
              >
                {k === 'ellipse' ? '◯ Circle' : '▭ Square'}
              </button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        {SLIDERS.map(({ label, key, min, max, step, fmt }) => (
          <div key={key} className={styles.sliderRow}>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderLabel}>{label}</span>
              <span className={styles.sliderValue}>{fmt(cfg[key] as number)}</span>
            </div>
            <input
              type="range"
              min={min} max={max} step={step}
              value={cfg[key] as number}
              title={label}
              className={styles.slider}
              onChange={(e) => set(key, parseFloat(e.target.value) as PatternConfig[typeof key])}
            />
          </div>
        ))}

        {/* Colors */}
        <div>
          <div className={styles.sectionLabel}>Color Gradient</div>
          <div className={styles.colorRow}>
            <div className={styles.colorSwatch}>
              <div className={styles.colorSwatchPreview} style={{ background: cfg.colorA }} />
              <input type="color" value={cfg.colorA} title="Start color" className={styles.colorSwatchInput}
                onChange={(e) => set('colorA', e.target.value)} />
            </div>
            <div className={styles.gradientPreview} style={{ background: `linear-gradient(90deg, ${cfg.colorA}, ${cfg.colorB})` }} />
            <div className={styles.colorSwatch}>
              <div className={styles.colorSwatchPreview} style={{ background: cfg.colorB }} />
              <input type="color" value={cfg.colorB} title="End color" className={styles.colorSwatchInput}
                onChange={(e) => set('colorB', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Rotate */}
        <label className={styles.rotateLabel}>
          <input type="checkbox" checked={cfg.rotate} className={styles.rotateCheckbox}
            onChange={(e) => set('rotate', e.target.checked)} />
          <span className={styles.rotateLabelText}>Rotate shapes with pattern</span>
        </label>

        {/* Generate */}
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className={styles.generateBtn}
        >
          {generating ? 'Generating…' : `✳ Generate ${cfg.count} shapes`}
        </button>
      </div>
    </div>
  )
}