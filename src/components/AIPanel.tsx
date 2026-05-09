import { useState, useRef } from 'react'
import { useCanvasStore, makeShape } from '@/store/canvasStore'
import { v4 as uuidv4 } from 'uuid'
import type { Shape } from '@/types'

// ─── Types returned by the AI ─────────────────────────────────────────────────

interface AIShape {
  type: 'rect' | 'ellipse' | 'line' | 'arrow' | 'text'
  name: string
  x: number
  y: number
  w?: number
  h?: number
  x2?: number
  y2?: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  cornerRadius?: number
  text?: string
  fontSize?: number
  fontWeight?: number
  opacity?: number
}

interface AIResponse {
  shapes: AIShape[]
  description: string
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a design assistant for ChromaCanvas, a vector design tool. 
When given a design prompt, respond ONLY with valid JSON describing an array of shapes to draw.

The canvas coordinate system starts at (0,0) top-left. Typical canvas is 1200x800.
Place designs centered around x:400-800, y:150-500 for good visibility.

Shape types and their required fields:
- rect:    { type, name, x, y, w, h, fill, stroke, strokeWidth, cornerRadius, opacity }
- ellipse: { type, name, x, y, w, h, fill, stroke, strokeWidth, opacity }
- text:    { type, name, x, y, w, h, text, fill, fontSize, fontWeight, opacity }
- line:    { type, name, x, y, x2, y2, stroke, strokeWidth, opacity }
- arrow:   { type, name, x, y, x2, y2, stroke, strokeWidth, opacity }

Rules:
- Use "none" for fill or stroke when not needed
- Colors must be valid hex (#rrggbb) or "none"
- fontSize between 12-72
- fontWeight: 400 (normal) or 700 (bold) or 600 (semibold)
- cornerRadius 0-20 for rects
- opacity 0-1
- Make designs beautiful with a cohesive dark-themed color palette using purples, blues, and accent colors
- Prefer: fills like #1e1230, #2d1f5e, #1a1a2e, accents like #8b5cf6, #6d28d9, #3b82f6, #06b6d4
- Text fill should be light: #e2e2e8, #c4b5fd, #a78bfa
- Always include 1-2 subtle background rects to ground the design
- Respond ONLY with this JSON structure, no markdown, no explanation:
{"shapes": [...], "description": "one sentence describing what was created"}`

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIPanel() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastDescription, setLastDescription] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addShape, setSelected, pushHistory, viewport } = useCanvasStore()

  const suggestions = [
    'A pricing card with title, 3 feature rows, and a CTA button',
    'A mobile app login screen with email and password fields',
    'A dashboard stat card with a number, label, and trend arrow',
    'A navigation bar with logo and 4 menu items',
    'A profile card with avatar, name, bio, and social links',
    'A notification badge with icon and message text',
    'A progress tracker with 3 steps and connecting lines',
    'A color palette showcase with 6 swatches and labels',
  ]

  const generate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)
    setLastDescription(null)

    try {
     const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  }),
})

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { error?: { message?: string } }).error?.message || `API error ${response.status}`)
      }
const data = await response.json()

const rawText =
  data.choices?.[0]?.message?.content ?? ''
      // Parse JSON — strip any accidental markdown fences
      const cleaned = rawText.replace(/```json|```/g, '').trim()
      const parsed: AIResponse = JSON.parse(cleaned)

      if (!parsed.shapes || !Array.isArray(parsed.shapes)) {
        throw new Error('Invalid response format')
      }

      // Center the design around the current viewport center
      const vpCenterX = (-viewport.x + 600) / viewport.zoom
      const vpCenterY = (-viewport.y + 400) / viewport.zoom

      // Find bounding box of generated shapes to re-center
      const xs = parsed.shapes.map((s) => s.x)
      const ys = parsed.shapes.map((s) => s.y)
      const minX = Math.min(...xs)
      const minY = Math.min(...ys)
      const maxX = Math.max(...parsed.shapes.map((s) => s.x + (s.w ?? (s.x2 ? s.x2 - s.x : 0))))
      const maxY = Math.max(...parsed.shapes.map((s) => s.y + (s.h ?? (s.y2 ? s.y2 - s.y : 0))))
      const designCX = (minX + maxX) / 2
      const designCY = (minY + maxY) / 2
      const offsetX = vpCenterX - designCX
      const offsetY = vpCenterY - designCY

      const newIds: string[] = []

      for (const aiShape of parsed.shapes) {
        const base = makeShape(aiShape.type, (aiShape.x + offsetX), (aiShape.y + offsetY))
        const id = uuidv4()

        const merged: Shape = {
          ...base,
          id,
          name: aiShape.name || aiShape.type,
          x: aiShape.x + offsetX,
          y: aiShape.y + offsetY,
          opacity: aiShape.opacity ?? 1,
        } as Shape

        // Apply type-specific fields
        if (aiShape.type === 'rect') {
          Object.assign(merged, {
            w: aiShape.w ?? 160, h: aiShape.h ?? 80,
            fill: aiShape.fill ?? '#2d1f5e',
            stroke: aiShape.stroke ?? 'none',
            strokeWidth: aiShape.strokeWidth ?? 1,
            cornerRadius: aiShape.cornerRadius ?? 0,
          })
        } else if (aiShape.type === 'ellipse') {
          Object.assign(merged, {
            w: aiShape.w ?? 80, h: aiShape.h ?? 80,
            fill: aiShape.fill ?? '#6d28d9',
            stroke: aiShape.stroke ?? 'none',
            strokeWidth: aiShape.strokeWidth ?? 1,
          })
        } else if (aiShape.type === 'text') {
          Object.assign(merged, {
            w: aiShape.w ?? 200, h: aiShape.h ?? 30,
            text: aiShape.text ?? '',
            fill: aiShape.fill ?? '#e2e2e8',
            fontSize: aiShape.fontSize ?? 16,
            fontWeight: aiShape.fontWeight ?? 400,
            fontFamily: 'Inter, sans-serif',
            textAlign: 'left',
            italic: false,
          })
        } else if (aiShape.type === 'line' || aiShape.type === 'arrow') {
          Object.assign(merged, {
            x2: (aiShape.x2 ?? aiShape.x + 100) + offsetX,
            y2: (aiShape.y2 ?? aiShape.y) + offsetY,
            stroke: aiShape.stroke ?? '#8b5cf6',
            strokeWidth: aiShape.strokeWidth ?? 1,
          })
        }

        addShape(merged)
        newIds.push(id)
      }

      setSelected(newIds)
      pushHistory()
      setLastDescription(parsed.description)
      setPrompt('')
    } catch (err) {
      console.error('AI generation error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate()
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        title="AI Shape Generator"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 200,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #3b82f6)',
          border: 'none',
          color: 'white',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(139,92,246,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.transform = 'scale(1.1)' }}
        onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.transform = 'scale(1)' }}
      >
        ✦
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 200,
      width: 360,
      background: '#18181d',
      border: '1px solid #2a2a35',
      borderRadius: 12,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.2)',
      overflow: 'hidden',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #2a2a35', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8' }}>AI Shape Generator</span>
          <span style={{ fontSize: 10, background: '#2d1f5e', color: '#a78bfa', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>BETA</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
        >×</button>
      </div>

      {/* Suggestions */}
      <div style={{ padding: '10px 12px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suggestions.slice(0, 4).map((s) => (
          <button
            key={s}
            onClick={() => { setPrompt(s); textareaRef.current?.focus() }}
            style={{
              background: '#1e1e26',
              border: '1px solid #2a2a35',
              color: '#888',
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 20,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.1s',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
            onMouseEnter={(e) => { const b = e.target as HTMLButtonElement; b.style.borderColor = '#7c3aed'; b.style.color = '#c4b5fd' }}
            onMouseLeave={(e) => { const b = e.target as HTMLButtonElement; b.style.borderColor = '#2a2a35'; b.style.color = '#888' }}
          >
            {s.length > 36 ? s.slice(0, 36) + '…' : s}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div style={{ padding: '10px 12px' }}>
        <label htmlFor="ai-prompt" style={{ display: 'block', fontSize: 11, color: '#555', marginBottom: 6, fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Describe your design
        </label>
        <textarea
          id="ai-prompt"
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKey}
          placeholder="A login card with email field, password field, and submit button…"
          title="Describe a design and AI will generate the shapes"
          rows={3}
          style={{
            width: '100%',
            background: '#111114',
            border: '1px solid #2a2a35',
            borderRadius: 6,
            color: '#e2e2e8',
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '8px 10px',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = '#7c3aed' }}
          onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = '#2a2a35' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#333', fontFamily: 'DM Mono, monospace' }}>Ctrl+Enter to generate</span>
          <button
            onClick={generate}
            disabled={!prompt.trim() || loading}
            style={{
              background: loading ? '#2d1f5e' : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
              border: 'none',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 16px',
              borderRadius: 6,
              cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              opacity: !prompt.trim() ? 0.4 : 1,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 13 }}>◌</span>
                Generating…
              </>
            ) : (
              <>✦ Generate</>
            )}
          </button>
        </div>
      </div>

      {/* Status */}
      {(error || lastDescription) && (
        <div style={{ padding: '0 12px 12px' }}>
          {error && (
            <div style={{ background: '#2d0f0f', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#f87171' }}>
              ⚠ {error}
            </div>
          )}
          {lastDescription && !error && (
            <div style={{ background: '#0f1e2d', border: '1px solid #1e3a5f', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#60a5fa', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span>✓</span>
              <span>{lastDescription}</span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
