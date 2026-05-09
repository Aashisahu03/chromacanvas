import { useState, useCallback, useRef, DragEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useCanvasStore } from '@/store/canvasStore'
import { preloadImage } from '@/utils/imageCache'
import type { ImageShape } from '@/types'
import styles from './ImagePanel.module.css'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = src
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredImage {
  id: string
  name: string
  src: string   // base64 data URL
  w: number     // natural width
  h: number     // natural height
}

type FitMode = 'original' | 'fit' | 'fill' | 'custom'

const FIT_LABELS: Record<FitMode, string> = {
  original: 'Original',
  fit:      'Fit 400px',
  fill:     'Fill 400²',
  custom:   'Custom',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImagePanel() {
  const [isOpen, setIsOpen]         = useState(false)
  const [images, setImages]         = useState<StoredImage[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fitMode, setFitMode]       = useState<FitMode>('fit')
  const [customW, setCustomW]       = useState(400)
  const [customH, setCustomH]       = useState(300)
  const [cornerRadius, setCornerRadius] = useState(0)
  const [loading, setLoading]       = useState(false)

  const { addShape, setSelected: selectShapes, pushHistory, viewport } = useCanvasStore()
  const addInputRef = useRef<HTMLInputElement>(null)

  // ── Load files ──────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (files: FileList | File[]) => {
    setLoading(true)
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const loaded: StoredImage[] = []

    for (const file of arr) {
      try {
        const src = await fileToDataURL(file)
        const { w, h } = await getImageDimensions(src)
        preloadImage(src)
        loaded.push({ id: uuidv4(), name: file.name.replace(/\.[^.]+$/, ''), src, w, h })
      } catch {
        console.warn('Failed to load image:', file.name)
      }
    }

    setImages((prev) => {
      const next = [...prev, ...loaded]
      if (!selected && next.length > 0) setSelected(next[0].id)
      return next
    })
    if (loaded.length > 0) setSelected(loaded[loaded.length - 1].id)
    setLoading(false)
  }, [selected])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false)
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files)
  }, [loadFiles])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) loadFiles(e.target.files)
    e.target.value = ''
  }, [loadFiles])

  // ── Remove image ────────────────────────────────────────────────────────
  const removeImage = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id)
      if (selected === id) setSelected(next[0]?.id ?? null)
      return next
    })
  }, [selected])

  // ── Place on canvas ─────────────────────────────────────────────────────
  const placeImage = useCallback(() => {
    const img = images.find((i) => i.id === selected)
    if (!img) return

    // Compute placement size
    let pw: number, ph: number
    const aspect = img.w / img.h
    if (fitMode === 'original') {
      pw = img.w; ph = img.h
    } else if (fitMode === 'fit') {
      pw = Math.min(img.w, 400); ph = pw / aspect
    } else if (fitMode === 'fill') {
      pw = 400; ph = 400
    } else {
      pw = customW; ph = customH
    }

    // Center in current viewport
    const cx = (-viewport.x + window.innerWidth  * 0.5) / viewport.zoom
    const cy = (-viewport.y + window.innerHeight * 0.5) / viewport.zoom

    const shape: ImageShape = {
      id:          uuidv4(),
      type:        'image',
      name:        img.name,
      x:           cx - pw / 2,
      y:           cy - ph / 2,
      w:           pw,
      h:           ph,
      src:         img.src,
      originalW:   img.w,
      originalH:   img.h,
      opacity:     1,
      locked:      false,
      hidden:      false,
      cornerRadius,
      stroke:      'none',
      strokeWidth: 0,
      flipX:       false,
      flipY:       false,
    }

    addShape(shape)
    selectShapes([shape.id])
    pushHistory()
  }, [images, selected, fitMode, customW, customH, cornerRadius, viewport, addShape, selectShapes, pushHistory])

  const selectedImg = images.find((i) => i.id === selected)

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} title="Import Images" className={styles.fab}>
        🖼
      </button>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>🖼</span>
          <span className={styles.headerTitle}>Image Import</span>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className={styles.closeBtn} aria-label="Close">×</button>
      </div>

      <div className={styles.body}>

        {/* Drop zone (only shown when no images) */}
        {images.length === 0 ? (
          <div
            className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <div className={styles.dropZoneIcon}>🖼</div>
            <div className={styles.dropZoneText}>
              Drop images here or{' '}
              <span className={styles.dropZoneAccent}>browse</span>
            </div>
            <div className={styles.dropZoneHint}>PNG, JPG, SVG, WebP, GIF</div>
            <input type="file" accept="image/*" multiple title="Select image files"
              className={styles.dropInput} onChange={onFileInput} />
          </div>
        ) : (
          /* Thumbnail grid */
          <div>
            <div className={styles.sectionLabel}>Images ({images.length})</div>
            <div className={styles.thumbGrid}>
              {images.map((img) => (
                <div
                  key={img.id}
                  className={styles.thumbItem}
                  style={{ borderColor: selected === img.id ? '#0ea5e9' : 'transparent' }}
                  onClick={() => setSelected(img.id)}
                  title={img.name}
                >
                  <img src={img.src} alt={img.name} className={styles.thumbImg} />
                  <button
                    type="button"
                    className={styles.thumbRemove}
                    onClick={(e) => removeImage(img.id, e)}
                    aria-label={`Remove ${img.name}`}
                  >×</button>
                </div>
              ))}
              {/* Add more button */}
              <div className={styles.thumbAdd} title="Add more images">
                +
                <input type="file" accept="image/*" multiple title="Add more images"
                  ref={addInputRef} className={styles.thumbAddInput} onChange={onFileInput} />
              </div>
            </div>
          </div>
        )}

        {/* Selected image info + options */}
        {selectedImg && (
          <>
            <div>
              <div className={styles.sectionLabel}>Selected — {selectedImg.name}</div>
              <div className={styles.optRow} style={{ marginBottom: 4 }}>
                <span className={styles.optLabel}>Original</span>
                <span style={{ fontSize: 11, color: '#555', fontFamily: 'DM Mono, monospace' }}>
                  {selectedImg.w} × {selectedImg.h}px
                </span>
              </div>
            </div>

            {/* Fit mode */}
            <div>
              <div className={styles.sectionLabel}>Place size</div>
              <div className={styles.optBtnRow}>
                {(['original', 'fit', 'fill', 'custom'] as FitMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFitMode(m)}
                    className={`${styles.optBtn} ${fitMode === m ? styles.optBtnActive : ''}`}
                  >{FIT_LABELS[m]}</button>
                ))}
              </div>
            </div>

            {/* Custom size inputs */}
            {fitMode === 'custom' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div className={styles.optRow} style={{ flex: 1 }}>
                  <span className={styles.optLabel}>W</span>
                  <input type="number" value={customW} min={1} max={4000}
                    title="Custom width" className={styles.optInput}
                    onChange={(e) => setCustomW(parseInt(e.target.value) || 400)} />
                </div>
                <div className={styles.optRow} style={{ flex: 1 }}>
                  <span className={styles.optLabel}>H</span>
                  <input type="number" value={customH} min={1} max={4000}
                    title="Custom height" className={styles.optInput}
                    onChange={(e) => setCustomH(parseInt(e.target.value) || 300)} />
                </div>
              </div>
            )}

            {/* Corner radius */}
            <div>
              <div className={styles.sectionLabel}>Corner Radius — {cornerRadius}px</div>
              <input type="range" min={0} max={200} step={2} value={cornerRadius}
                title="Corner radius" className={styles.optInput}
                style={{ width: '100%', accentColor: '#0ea5e9' }}
                onChange={(e) => setCornerRadius(parseInt(e.target.value))} />
            </div>

            {/* Place button */}
            <button type="button" onClick={placeImage} className={styles.placeBtn}>
              🖼 Place on Canvas
            </button>
          </>
        )}

        {loading && <div className={styles.empty}>Loading images…</div>}
      </div>
    </div>
  )
}