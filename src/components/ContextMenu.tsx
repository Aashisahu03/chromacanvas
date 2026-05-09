import { useEffect, useRef } from 'react'
import { useCanvasStore } from '@/store/canvasStore'

interface Props {
  x: number
  y: number
  onClose: () => void
}

export default function ContextMenu({ x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { selectedIds, deleteSelected, duplicateSelected, bringToFront, sendToBack, bringForward, sendBackward } = useCanvasStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (selectedIds.length === 0) return null

  const id = selectedIds[0]

  const items = [
    { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => { duplicateSelected(); onClose() } },
    { label: 'Bring Forward', action: () => { bringForward(id); onClose() } },
    { label: 'Bring to Front', shortcut: 'Ctrl+Shift+]', action: () => { bringToFront(id); onClose() } },
    { label: 'Send Backward', action: () => { sendBackward(id); onClose() } },
    { label: 'Send to Back', shortcut: 'Ctrl+Shift+[', action: () => { sendToBack(id); onClose() } },
    null, // divider
    { label: 'Delete', shortcut: 'Del', action: () => { deleteSelected(); onClose() }, danger: true },
  ]

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#1e1e26] border border-[#2a2a35] rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 border-t border-[#2a2a35]" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono transition-colors text-left
              ${item.danger
                ? 'text-red-600 hover:bg-red-950/40 hover:text-red-400'
                : 'text-[#aaa] hover:bg-[#2a2a35] hover:text-[#eee]'}`}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="text-[#333] ml-4">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  )
}
