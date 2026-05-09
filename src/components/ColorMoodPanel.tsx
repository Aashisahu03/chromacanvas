import { useState, useCallback, useRef, DragEvent } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import type { Shape, RectShape, EllipseShape, TextShape, LineShape, ArrowShape } from '@/types'
import styles from './ColorMoodPanel.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Palette {
  name: string
  colors: string[]  // 5 hex colors
}

type RecolorMode = 'fills' | 'strokes' | 'both'
type Tab = 'photo' | 'vibe'

// ─── Vibe suggestions ─────────────────────────────────────────────────────────

const VIBE_SUGGESTIONS = [
  'cyberpunk sunset', 'deep ocean', 'forest at dawn',
  'neon tokyo night', 'desert sand dunes', 'aurora borealis',
  'vintage film noir', 'candy pop pastel', 'volcanic lava',
  'arctic ice cave', 'cherry blossom spring', 'midnight galaxy',
]

// ─── Color extraction from image ─────────────────────────────────────────────

function extractPaletteFromImage(img: HTMLImageElement, count = 5): string[] {
  const canvas = document.createElement('canvas')
  const MAX = 100
  const scale = Math.min(MAX / img.width, MAX / img.height, 1)
  canvas.width  = Math.floor(img.width  * scale)
  canvas.height = Math.floor(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const pixels: [number, number, number][] = []

  // Sample every 4th pixel
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3]
    if (a < 128) continue // skip transparent
    // Skip near-black and near-white
    const brightness = (r + g + b) / 3
    if (brightness < 15 || brightness > 240) continue
    pixels.push([r, g, b])
  }

  if (pixels.length === 0) return ['#6d28d9','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd']

  // Simple k-means clustering
  const clusters = kMeans(pixels, count)
  return clusters.map(([r, g, b]) =>
    `#${Math.round(r).toString(16).padStart(2,'0')}${Math.round(g).toString(16).padStart(2,'0')}${Math.round(b).toString(16).padStart(2,'0')}`
  )
}

function kMeans(pixels: [number,number,number][], k: number, iterations = 10): [number,number,number][] {
  // Init centroids spread across pixels
  const step = Math.floor(pixels.length / k)
  let centroids: [number,number,number][] = Array.from({ length: k }, (_, i) => [...pixels[i * step]] as [number,number,number])

  for (let iter = 0; iter < iterations; iter++) {
    const buckets: [number,number,number][][] = Array.from({ length: k }, () => [])

    for (const px of pixels) {
      let best = 0, bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const d = colorDist(px, centroids[c])
        if (d < bestDist) { bestDist = d; best = c }
      }
      buckets[best].push(px)
    }

    centroids = buckets.map((bucket, i) => {
      if (bucket.length === 0) return centroids[i]
      const avg = bucket.reduce(([ar,ag,ab],[r,g,b]) => [ar+r, ag+g, ab+b] as [number,number,number], [0,0,0] as [number,number,number])
      return [avg[0]/bucket.length, avg[1]/bucket.length, avg[2]/bucket.length] as [number,number,number]
    })
  }

  // Sort by perceived brightness (darkest to lightest for nice display)
  return [...centroids].sort((a, b) => (a[0]+a[1]+a[2]) - (b[0]+b[1]+b[2]))
}

function colorDist(a: [number,number,number], b: [number,number,number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}

// ─── Groq AI palette generation ───────────────────────────────────────────────

const GROQ_SYSTEM = `You are a color palette designer. Given a mood or vibe description, respond ONLY with valid JSON.
No markdown, no explanation, just the JSON object.
Format: {"name": "palette name (2-3 words)", "colors": ["#hex1","#hex2","#hex3","#hex4","#hex5"]}
Rules:
- Exactly 5 hex colors
- Colors should form a cohesive, beautiful palette matching the vibe
- Range from dark/shadow tones to highlight tones
- All hex values must be valid 6-digit hex codes starting with #`

async function generatePaletteFromVibe(vibe: string, apiKey: string): Promise<Palette> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      temperature: 0.9,
      messages: [
        { role: 'system', content: GROQ_SYSTEM },
        { role: 'user', content: `Generate a color palette for: "${vibe}"` },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(err.error?.message || `Groq API error ${res.status}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const raw = data.choices?.[0]?.message?.content ?? ''
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned) as Palette

  if (!parsed.colors || parsed.colors.length < 3) throw new Error('Invalid palette response')
  return { name: parsed.name || vibe, colors: parsed.colors.slice(0, 5) }
}

// ─── Recolor logic ────────────────────────────────────────────────────────────

function recolorShapes(shapes: Shape[], palette: string[], mode: RecolorMode): Shape[] {
  const colorShapes = shapes.filter((s) => !s.hidden && !s.locked)
  if (colorShapes.length === 0) return shapes

  // Map each unique color in the design to a palette color
  const uniqueFills   = [...new Set(colorShapes.map((s) => ('fill'   in s ? (s as RectShape).fill   : null)).filter(Boolean).filter((c) => c !== 'none'))] as string[]
  const uniqueStrokes = [...new Set(colorShapes.map((s) => ('stroke' in s ? (s as RectShape).stroke : null)).filter(Boolean).filter((c) => c !== 'none'))] as string[]

  const fillMap   = new Map<string, string>()
  const strokeMap = new Map<string, string>()

  uniqueFills.forEach((c, i)   => fillMap.set(c,   palette[i % palette.length]))
  uniqueStrokes.forEach((c, i) => strokeMap.set(c, palette[(i + 2) % palette.length]))

  return shapes.map((s) => {
    const updates: Partial<Shape> = {}

    if ((mode === 'fills' || mode === 'both') && 'fill' in s) {
      const fill = (s as RectShape | EllipseShape | TextShape).fill
      if (fill && fill !== 'none' && fillMap.has(fill)) {
        (updates as Partial<RectShape>).fill = fillMap.get(fill)!
      }
    }

    if ((mode === 'strokes' || mode === 'both') && 'stroke' in s) {
      const stroke = (s as RectShape | LineShape | ArrowShape).stroke
      if (stroke && stroke !== 'none' && strokeMap.has(stroke)) {
        (updates as Partial<RectShape>).stroke = strokeMap.get(stroke)!
      }
    }

    return Object.keys(updates).length > 0 ? { ...s, ...updates } as Shape : s
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ColorMoodPanel() {
  const [isOpen, setIsOpen]       = useState(false)
  const [tab, setTab]             = useState<Tab>('vibe')
  const [palette, setPalette]     = useState<Palette | null>(null)
  const [vibe, setVibe]           = useState('')
  const [imageUrl, setImageUrl]   = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [recolorMode, setRecolorMode] = useState<RecolorMode>('both')
  const [loading, setLoading]     = useState(false)
  const [status, setStatus]       = useState<{ msg: string; type: 'info'|'error'|'success' } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const { shapes, setShapes, pushHistory } = useCanvasStore()
  const groqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined

  // ── Load image ──────────────────────────────────────────────────────────
  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { setStatus({ msg: 'Please drop an image file', type: 'error' }); return }
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setPalette(null)
    setStatus({ msg: 'Extracting colors…', type: 'info' })

    const img = new Image()
    img.onload = () => {
      const colors = extractPaletteFromImage(img, 5)
      setPalette({ name: file.name.replace(/\.[^.]+$/, ''), colors })
      setStatus({ msg: `Extracted ${colors.length} colors`, type: 'success' })
    }
    img.onerror = () => setStatus({ msg: 'Failed to load image', type: 'error' })
    img.src = url
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadImage(file)
  }, [loadImage])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file)
  }, [loadImage])

  // ── Generate from vibe ──────────────────────────────────────────────────
  const generateFromVibe = useCallback(async () => {
    if (!vibe.trim()) return
    if (!groqKey) { setStatus({ msg: 'Add VITE_GROQ_API_KEY to .env', type: 'error' }); return }
    setLoading(true)
    setStatus({ msg: 'Asking Groq for palette…', type: 'info' })
    try {
      const p = await generatePaletteFromVibe(vibe.trim(), groqKey)
      setPalette(p)
      setStatus({ msg: `"${p.name}" palette ready`, type: 'success' })
    } catch (err) {
      setStatus({ msg: err instanceof Error ? err.message : 'Failed', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [vibe, groqKey])

  // ── Apply palette to canvas ─────────────────────────────────────────────
  const applyPalette = useCallback(() => {
    if (!palette) return
    const recolored = recolorShapes(shapes, palette.colors, recolorMode)
    setShapes(recolored)
    pushHistory()
    setStatus({ msg: `Applied "${palette.name}" to ${shapes.filter(s => !s.hidden && !s.locked).length} shapes`, type: 'success' })
  }, [palette, shapes, recolorMode, setShapes, pushHistory])

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} title="AI Color Mood" className={styles.fab}>
        🎨
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🎨</span>
          <span className={styles.headerTitle}>AI Color Mood</span>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className={styles.closeBtn} aria-label="Close panel">×</button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button type="button" onClick={() => setTab('vibe')} className={`${styles.tab} ${tab === 'vibe' ? styles.tabActive : ''}`}>
          ✦ Describe a Vibe
        </button>
        <button type="button" onClick={() => setTab('photo')} className={`${styles.tab} ${tab === 'photo' ? styles.tabActive : ''}`}>
          📷 Extract from Photo
        </button>
      </div>

      <div className={styles.body}>

        {/* ── Vibe tab ── */}
        {tab === 'vibe' && (
          <>
            <div>
              <div className={styles.sectionLabel}>Describe your vibe</div>
              <input
                type="text"
                className={styles.vibeInput}
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') generateFromVibe() }}
                placeholder="e.g. cyberpunk sunset, deep ocean…"
                title="Describe a color mood or vibe"
              />
            </div>
            <div>
              <div className={styles.sectionLabel}>Suggestions</div>
              <div className={styles.vibeChips}>
                {VIBE_SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className={styles.vibeChip}
                    onClick={() => { setVibe(s) }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={generateFromVibe}
              disabled={!vibe.trim() || loading}
              className={styles.actionBtn}
            >
              {loading ? '⟳ Generating palette…' : '✦ Generate Palette'}
            </button>
          </>
        )}

        {/* ── Photo tab ── */}
        {tab === 'photo' && (
          <>
            {!imageUrl ? (
              <div
                className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
              >
                <div className={styles.dropZoneIcon}>🖼</div>
                <div className={styles.dropZoneText}>
                  Drop an image here or{' '}
                  <span className={styles.dropZoneAccent}>browse</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  title="Upload an image to extract colors"
                  className={styles.dropInput}
                  onChange={onFileInput}
                />
              </div>
            ) : (
              <div className={styles.imagePreview}>
                <img ref={imgRef} src={imageUrl} alt="Source for color extraction" />
                <button type="button" className={styles.imagePreviewClear}
                  onClick={() => { setImageUrl(null); setPalette(null); setStatus(null) }}
                  aria-label="Remove image">×</button>
              </div>
            )}
          </>
        )}

        {/* ── Palette display (shared) ── */}
        {palette && (
          <>
            <div className={styles.palette}>
              <div className={styles.paletteRow}>
                {palette.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={styles.paletteChip}
                    style={{ background: color }}
                    title={color}
                    onClick={() => navigator.clipboard?.writeText(color)}
                    aria-label={`Copy color ${color}`}
                  >
                    <span className={styles.paletteChipLabel}>{color}</span>
                  </button>
                ))}
              </div>
              {palette.name && <div className={styles.paletteName}>"{palette.name}"</div>}
            </div>

            {/* Recolor mode */}
            <div>
              <div className={styles.sectionLabel}>Apply to</div>
              <div className={styles.recolorOptions}>
                {(['fills', 'strokes', 'both'] as RecolorMode[]).map((m) => (
                  <button key={m} type="button"
                    onClick={() => setRecolorMode(m)}
                    className={`${styles.recolorBtn} ${recolorMode === m ? styles.recolorBtnActive : ''}`}>
                    {m === 'fills' ? '■ Fills' : m === 'strokes' ? '□ Strokes' : '◈ Both'}
                  </button>
                ))}
              </div>
            </div>

            <button type="button" onClick={applyPalette} className={styles.actionBtn}>
              🎨 Apply to Canvas
            </button>
          </>
        )}

        {/* No shapes warning */}
        {palette && shapes.filter(s => !s.hidden && !s.locked).length === 0 && (
          <div className={styles.emptyState}>No visible shapes on canvas.<br />Draw something first!</div>
        )}

        {/* Status */}
        {status && (
          <div className={`${styles.status} ${status.type === 'error' ? styles.statusError : status.type === 'success' ? styles.statusSuccess : ''}`}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  )
}