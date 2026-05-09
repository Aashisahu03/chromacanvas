import { useCanvasStore } from '@/store/canvasStore'
import type { Shape, RectShape, EllipseShape, TextShape } from '@/types'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] text-[#444] uppercase tracking-widest font-semibold">{children}</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 border-b border-[#1e1e26]">
      <Label>{title}</Label>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#555] w-5 shrink-0 font-mono">{label}</span>
      {children}
    </div>
  )
}

function NumberInput({ value, onChange, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <input
      type="number"
      value={Math.round(value * 100) / 100}
      min={min} max={max} step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="flex-1 bg-[#111114] border border-[#2a2a35] text-[#ddd] text-xs font-mono px-2 py-1 rounded outline-none focus:border-violet-500 w-full"
    />
  )
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const isNone = value === 'none'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#555] w-10 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 flex-1">
        <div className="relative">
          <div
            className="w-6 h-6 rounded border border-[#333] cursor-pointer"
            style={{ background: isNone ? 'repeating-linear-gradient(45deg, #333 0px, #333 4px, #222 4px, #222 8px)' : value }}
          />
          {!isNone && (
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          )}
        </div>
        <input
          type="text"
          value={isNone ? 'none' : value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#111114] border border-[#2a2a35] text-[#ddd] text-[11px] font-mono px-2 py-1 rounded outline-none focus:border-violet-500 min-w-0"
        />
        <button
          onClick={() => onChange(isNone ? '#6d28d9' : 'none')}
          title={isNone ? 'Enable' : 'Set None'}
          className={`text-[10px] px-1.5 py-1 rounded transition-colors ${isNone ? 'bg-violet-900/50 text-violet-300' : 'bg-[#1e1e26] text-[#555] hover:text-[#aaa]'}`}
        >∅</button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertiesPanel() {
  const { shapes, selectedIds, updateShape, pushHistory, deleteSelected, duplicateSelected, bringToFront, sendToBack, bringForward, sendBackward } = useCanvasStore()

  if (selectedIds.length === 0) {
    return (
      <aside className="w-52 bg-[#18181d] border-l border-[#2a2a35] overflow-y-auto shrink-0">
        <div className="px-3 py-3">
          <Label>Properties</Label>
          <p className="text-[11px] text-[#333] mt-3 leading-relaxed font-mono">
            Select an element to edit properties.
          </p>
          <div className="mt-4 space-y-1 text-[10px] text-[#2a2a35] font-mono leading-loose">
            <div>V — select</div>
            <div>H — pan</div>
            <div>R — rectangle</div>
            <div>E — ellipse</div>
            <div>L — line</div>
            <div>A — arrow</div>
            <div>T — text</div>
            <div>Del — delete</div>
            <div>Ctrl+D — duplicate</div>
            <div>Ctrl+Z/Y — undo/redo</div>
            <div>Ctrl+A — select all</div>
            <div>0 — reset zoom</div>
            <div>Scroll — zoom</div>
            <div>Space+drag — pan</div>
          </div>
        </div>
      </aside>
    )
  }

  if (selectedIds.length > 1) {
    return (
      <aside className="w-52 bg-[#18181d] border-l border-[#2a2a35] overflow-y-auto shrink-0">
        <div className="px-3 py-3">
          <Label>Properties</Label>
          <p className="text-[11px] text-[#555] mt-2 font-mono">{selectedIds.length} elements selected</p>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          <button onClick={duplicateSelected} className="w-full text-[11px] py-1.5 rounded bg-[#1e1e26] text-[#888] hover:text-[#ddd] hover:bg-[#2a2a35] transition-all font-mono">Duplicate All</button>
          <button onClick={deleteSelected} className="w-full text-[11px] py-1.5 rounded bg-[#1e1e26] text-red-700 hover:text-red-400 hover:bg-red-950/30 transition-all font-mono">Delete All</button>
        </div>
      </aside>
    )
  }

  const shape = shapes.find((s) => s.id === selectedIds[0])
  if (!shape) return null

  const update = (key: string, val: unknown) => updateShape(shape.id, { [key]: val } as Partial<Shape>)
  const updateAndSave = (key: string, val: unknown) => { update(key, val); pushHistory() }
  const isLine = shape.type === 'line' || shape.type === 'arrow'

  return (
    <aside className="w-52 bg-[#18181d] border-l border-[#2a2a35] overflow-y-auto shrink-0 scrollbar-thin">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#1e1e26] flex items-center gap-2">
        <Label>{shape.type}</Label>
        <span className="text-[10px] text-[#333] truncate flex-1 text-right font-mono">{shape.id.slice(0, 8)}</span>
      </div>

      {/* Name */}
      <Section title="Name">
        <input
          type="text"
          value={shape.name || ''}
          onChange={(e) => update('name', e.target.value)}
          onBlur={() => pushHistory()}
          placeholder={shape.type}
          className="w-full bg-[#111114] border border-[#2a2a35] text-[#ddd] text-xs font-mono px-2 py-1 rounded outline-none focus:border-violet-500"
        />
      </Section>

      {/* Position & Size */}
      {!isLine && 'x' in shape && 'w' in shape && (
        <Section title="Position & Size">
          <div className="grid grid-cols-2 gap-1.5">
            <Row label="X"><NumberInput value={shape.x} onChange={(v) => updateAndSave('x', v)} /></Row>
            <Row label="Y"><NumberInput value={shape.y} onChange={(v) => updateAndSave('y', v)} /></Row>
            <Row label="W"><NumberInput value={(shape as { w: number }).w} min={1} onChange={(v) => updateAndSave('w', Math.max(1, v))} /></Row>
            <Row label="H"><NumberInput value={(shape as { h: number }).h} min={1} onChange={(v) => updateAndSave('h', Math.max(1, v))} /></Row>
          </div>
          {shape.type === 'rect' && (
            <Row label="R↻">
              <NumberInput value={(shape as RectShape).cornerRadius} min={0} max={999} onChange={(v) => updateAndSave('cornerRadius', v)} />
            </Row>
          )}
        </Section>
      )}

      {/* Line endpoints */}
      {isLine && (
        <Section title="Endpoints">
          <div className="grid grid-cols-2 gap-1.5">
            <Row label="x1"><NumberInput value={shape.x} onChange={(v) => updateAndSave('x', v)} /></Row>
            <Row label="y1"><NumberInput value={shape.y} onChange={(v) => updateAndSave('y', v)} /></Row>
            <Row label="x2"><NumberInput value={(shape as { x2: number }).x2} onChange={(v) => updateAndSave('x2', v)} /></Row>
            <Row label="y2"><NumberInput value={(shape as { y2: number }).y2} onChange={(v) => updateAndSave('y2', v)} /></Row>
          </div>
        </Section>
      )}

      {/* Fill */}
      {shape.type !== 'line' && shape.type !== 'arrow' && shape.type !== 'text' && (
        <Section title="Fill">
          <ColorInput
            label="Fill"
            value={(shape as RectShape | EllipseShape).fill}
            onChange={(v) => updateAndSave('fill', v)}
          />
        </Section>
      )}

      {/* Text color */}
      {shape.type === 'text' && (
        <Section title="Text">
          <ColorInput
            label="Color"
            value={(shape as TextShape).fill}
            onChange={(v) => updateAndSave('fill', v)}
          />
          <Row label="Sz">
            <NumberInput value={(shape as TextShape).fontSize} min={6} max={300} onChange={(v) => updateAndSave('fontSize', v)} />
          </Row>
          <Row label="Wt">
            <NumberInput value={(shape as TextShape).fontWeight} min={100} max={900} step={100} onChange={(v) => updateAndSave('fontWeight', v)} />
          </Row>
          <div className="flex gap-1 mt-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => updateAndSave('textAlign', align)}
                className={`flex-1 text-[10px] py-1 rounded transition-colors ${(shape as TextShape).textAlign === align ? 'bg-violet-900/60 text-violet-300' : 'bg-[#1e1e26] text-[#555] hover:text-[#aaa]'}`}
              >{align === 'left' ? '⫷' : align === 'center' ? '≡' : '⫸'}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={(shape as TextShape).italic}
              onChange={(e) => updateAndSave('italic', e.target.checked)}
              className="accent-violet-500"
            />
            <span className="text-[11px] text-[#666]">Italic</span>
          </label>
          <div className="mt-1">
            <select
              value={(shape as TextShape).fontFamily}
              onChange={(e) => updateAndSave('fontFamily', e.target.value)}
              className="w-full bg-[#111114] border border-[#2a2a35] text-[#ddd] text-xs font-mono px-2 py-1 rounded outline-none focus:border-violet-500"
            >
              <option value="Inter, sans-serif">Inter</option>
              <option value="DM Mono, monospace">DM Mono</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Courier New', monospace">Courier New</option>
            </select>
          </div>
        </Section>
      )}

      {/* Stroke */}
      {shape.type !== 'text' && (
        <Section title="Stroke">
          <ColorInput
            label="Color"
            value={(shape as RectShape).stroke ?? 'none'}
            onChange={(v) => updateAndSave('stroke', v)}
          />
          <Row label="W">
            <NumberInput value={(shape as RectShape).strokeWidth ?? 1} min={0} max={50} onChange={(v) => updateAndSave('strokeWidth', v)} />
          </Row>
        </Section>
      )}

      {/* Opacity */}
      <Section title="Opacity">
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={1} step={0.01}
            value={shape.opacity ?? 1}
            onChange={(e) => update('opacity', parseFloat(e.target.value))}
            onMouseUp={() => pushHistory()}
            className="flex-1 accent-violet-500"
          />
          <span className="text-[11px] font-mono text-[#555] w-8 text-right">
            {Math.round((shape.opacity ?? 1) * 100)}%
          </span>
        </div>
      </Section>

      {/* Layer order */}
      <Section title="Layer Order">
        <div className="grid grid-cols-2 gap-1">
          <button onClick={() => bringToFront(shape.id)} className="text-[10px] py-1.5 rounded bg-[#1e1e26] text-[#555] hover:text-[#bbb] hover:bg-[#2a2a35] transition-all font-mono">↑ Front</button>
          <button onClick={() => sendToBack(shape.id)} className="text-[10px] py-1.5 rounded bg-[#1e1e26] text-[#555] hover:text-[#bbb] hover:bg-[#2a2a35] transition-all font-mono">↓ Back</button>
          <button onClick={() => bringForward(shape.id)} className="text-[10px] py-1.5 rounded bg-[#1e1e26] text-[#555] hover:text-[#bbb] hover:bg-[#2a2a35] transition-all font-mono">↑ Fwd</button>
          <button onClick={() => sendBackward(shape.id)} className="text-[10px] py-1.5 rounded bg-[#1e1e26] text-[#555] hover:text-[#bbb] hover:bg-[#2a2a35] transition-all font-mono">↓ Back</button>
        </div>
      </Section>

      {/* Visibility & Lock */}
      <Section title="State">
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!shape.hidden}
              onChange={() => useCanvasStore.getState().toggleVisibility(shape.id)}
              className="accent-violet-500"
            />
            <span className="text-[11px] text-[#666]">Visible</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={shape.locked}
              onChange={() => useCanvasStore.getState().toggleLock(shape.id)}
              className="accent-violet-500"
            />
            <span className="text-[11px] text-[#666]">Locked</span>
          </label>
        </div>
      </Section>

      {/* Actions */}
      <div className="px-3 py-3 space-y-1.5">
        <button onClick={duplicateSelected} className="w-full text-[11px] py-1.5 rounded bg-[#1e1e26] text-[#777] hover:text-[#ddd] hover:bg-[#2a2a35] transition-all font-mono">
          ⧉ Duplicate
        </button>
        <button onClick={deleteSelected} className="w-full text-[11px] py-1.5 rounded bg-[#1e1e26] text-red-800 hover:text-red-400 hover:bg-red-950/30 transition-all font-mono">
          ✕ Delete
        </button>
      </div>
    </aside>
  )
}
