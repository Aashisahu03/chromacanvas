import { useCanvasStore } from '@/store/canvasStore'
import { downloadSVG, saveJSON, loadJSON } from '@/utils/exportUtils'
import type { Tool } from '@/types'

const tools: { id: Tool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: '✦', label: 'Select', key: 'V' },
  { id: 'hand', icon: '✋', label: 'Pan', key: 'H' },
  { id: 'rect', icon: '▭', label: 'Rectangle', key: 'R' },
  { id: 'ellipse', icon: '◯', label: 'Ellipse', key: 'E' },
  { id: 'line', icon: '╱', label: 'Line', key: 'L' },
  { id: 'arrow', icon: '→', label: 'Arrow', key: 'A' },
  { id: 'text', icon: 'T', label: 'Text', key: 'T' },
]

export default function Toolbar() {
  const { activeTool, setTool, undo, redo, canUndo, canRedo, shapes, setShapes, viewport, zoomTo, zoomFit, showGrid, snapToGrid, toggleGrid, toggleSnap, pushHistory } = useCanvasStore()

  const handleLoadJSON = async () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async () => {
      if (!input.files?.[0]) return
      try {
        const loaded = await loadJSON(input.files[0])
        setShapes(loaded)
        pushHistory()
      } catch {
        alert('Failed to load file')
      }
    }
    input.click()
  }

  return (
    <header className="h-11 bg-[#18181d] border-b border-[#2a2a35] flex items-center gap-1 px-3 shrink-0 select-none">
      {/* Logo */}
      <span className="text-violet-400 font-mono font-bold text-sm tracking-wider mr-3">◈ ChromaCanvas</span>

      <div className="w-px h-5 bg-[#2a2a35] mx-1" />

      {/* Tools */}
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
          className={`w-8 h-8 rounded-md flex items-center justify-center text-sm transition-all
            ${activeTool === t.id
              ? 'bg-violet-900 text-violet-300'
              : 'text-[#666] hover:bg-[#22222a] hover:text-[#ccc]'}`}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-px h-5 bg-[#2a2a35] mx-1" />

      {/* History */}
      <button
        onClick={undo}
        disabled={!canUndo()}
        title="Undo (Ctrl+Z)"
        className="w-8 h-8 rounded-md flex items-center justify-center text-sm transition-all text-[#666] hover:bg-[#22222a] hover:text-[#ccc] disabled:opacity-30 disabled:cursor-not-allowed"
      >↩</button>
      <button
        onClick={redo}
        disabled={!canRedo()}
        title="Redo (Ctrl+Y)"
        className="w-8 h-8 rounded-md flex items-center justify-center text-sm transition-all text-[#666] hover:bg-[#22222a] hover:text-[#ccc] disabled:opacity-30 disabled:cursor-not-allowed"
      >↪</button>

      <div className="w-px h-5 bg-[#2a2a35] mx-1" />

      {/* View options */}
      <button
        onClick={toggleGrid}
        title="Toggle Grid (Ctrl+')"
        className={`h-7 px-2 rounded text-xs transition-all font-mono
          ${showGrid ? 'bg-violet-900/50 text-violet-300' : 'text-[#555] hover:bg-[#22222a] hover:text-[#aaa]'}`}
      >Grid</button>
      <button
        onClick={toggleSnap}
        title="Snap to Grid"
        className={`h-7 px-2 rounded text-xs transition-all font-mono
          ${snapToGrid ? 'bg-violet-900/50 text-violet-300' : 'text-[#555] hover:bg-[#22222a] hover:text-[#aaa]'}`}
      >Snap</button>

      <div className="w-px h-5 bg-[#2a2a35] mx-1" />

      {/* Zoom */}
      <button
        onClick={zoomFit}
        title="Reset Zoom (0)"
        className="h-7 px-2 rounded text-xs font-mono text-[#555] hover:bg-[#22222a] hover:text-[#aaa] transition-all min-w-[48px]"
      >{Math.round(viewport.zoom * 100)}%</button>
      <button onClick={() => zoomTo(viewport.zoom * 1.25)} title="Zoom In" className="w-7 h-7 rounded flex items-center justify-center text-sm text-[#555] hover:bg-[#22222a] hover:text-[#aaa] transition-all">+</button>
      <button onClick={() => zoomTo(viewport.zoom / 1.25)} title="Zoom Out" className="w-7 h-7 rounded flex items-center justify-center text-sm text-[#555] hover:bg-[#22222a] hover:text-[#aaa] transition-all">−</button>

      <div className="flex-1" />

      {/* File ops */}
      <button
        onClick={handleLoadJSON}
        title="Open file"
        className="h-7 px-3 rounded text-xs font-mono text-[#555] hover:bg-[#22222a] hover:text-[#aaa] transition-all"
      >Open</button>
      <button
        onClick={() => saveJSON(shapes)}
        title="Save as JSON"
        className="h-7 px-3 rounded text-xs font-mono text-[#555] hover:bg-[#22222a] hover:text-[#aaa] transition-all"
      >Save</button>
      <button
        onClick={() => downloadSVG(shapes)}
        title="Export SVG (Ctrl+Shift+E)"
        className="h-7 px-3 rounded text-xs font-mono bg-violet-900/40 text-violet-300 hover:bg-violet-800/50 transition-all"
      >SVG ↓</button>
    </header>
  )
}
