import { useCanvasStore } from '@/store/canvasStore'
import type { Shape } from '@/types'

const typeIcon: Record<Shape['type'], string> = {
  image: '🖼',
  rect: '▭', ellipse: '◯', line: '╱', arrow: '→', text: 'T',
}

export default function LayersPanel() {
  const {
    shapes, selectedIds, setSelected, addToSelection,
    toggleVisibility, toggleLock, bringToFront, sendToBack,
    deleteShape,
  } = useCanvasStore()

  const reversed = [...shapes].reverse()

  return (
    <aside className="w-52 bg-[#18181d] border-r border-[#2a2a35] flex flex-col overflow-hidden shrink-0">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#444] tracking-widest uppercase">Layers</span>
        <span className="text-[10px] text-[#333] font-mono">{shapes.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {reversed.length === 0 && (
          <p className="text-[11px] text-[#333] px-3 py-4 leading-relaxed">
            Draw a shape to begin.<br />Use R, E, L, A, T keys.
          </p>
        )}

        {reversed.map((shape) => {
          const isSelected = selectedIds.includes(shape.id)
          return (
            <div
              key={shape.id}
              onClick={(e) => {
                if (e.shiftKey) addToSelection(shape.id)
                else setSelected([shape.id])
              }}
              onDoubleClick={() => {
                // Zoom to shape
                const store = useCanvasStore.getState()
                if ('w' in shape) {
                  const cx = shape.x + (shape as { w: number }).w / 2
                  const cy = shape.y + (shape as { h: number }).h / 2
                  store.setViewport({ x: -cx * store.viewport.zoom + 400, y: -cy * store.viewport.zoom + 300 })
                }
              }}
              className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs transition-colors
                ${isSelected
                  ? 'bg-violet-900/40 text-violet-200'
                  : 'text-[#888] hover:bg-[#1e1e26] hover:text-[#bbb]'}`}
            >
              {/* Type icon */}
              <span className="text-[10px] w-4 text-center opacity-60 shrink-0">
                {typeIcon[shape.type]}
              </span>

              {/* Name */}
              <span className="flex-1 truncate font-mono text-[11px]">
                {shape.name || `${shape.type} ${shapes.indexOf(shape) + 1}`}
              </span>

              {/* Controls */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLock(shape.id) }}
                  title={shape.locked ? 'Unlock' : 'Lock'}
                  className="text-[9px] hover:text-violet-300 transition-colors"
                >
                  {shape.locked ? '🔒' : '🔓'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleVisibility(shape.id) }}
                  title={shape.hidden ? 'Show' : 'Hide'}
                  className="text-[10px] hover:text-violet-300 transition-colors"
                >
                  {shape.hidden ? '○' : '●'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Layer order actions */}
      {selectedIds.length === 1 && (
        <div className="border-t border-[#2a2a35] p-2 flex gap-1">
          <button
            onClick={() => bringToFront(selectedIds[0])}
            title="Bring to Front"
            className="flex-1 text-[10px] py-1 rounded bg-[#1e1e26] text-[#555] hover:text-[#aaa] hover:bg-[#2a2a35] transition-all font-mono"
          >↑ Front</button>
          <button
            onClick={() => sendToBack(selectedIds[0])}
            title="Send to Back"
            className="flex-1 text-[10px] py-1 rounded bg-[#1e1e26] text-[#555] hover:text-[#aaa] hover:bg-[#2a2a35] transition-all font-mono"
          >↓ Back</button>
          <button
            onClick={() => deleteShape(selectedIds[0])}
            title="Delete"
            className="text-[10px] py-1 px-2 rounded bg-[#1e1e26] text-[#555] hover:text-red-400 hover:bg-red-950/40 transition-all"
          >✕</button>
        </div>
      )}
    </aside>
  )
}