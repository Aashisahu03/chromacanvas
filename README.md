# ◈ ChromaCanvas

> A browser-based vector design tool with real-time multiplayer — built with React, TypeScript, Zustand, and Liveblocks.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/chromacanvas)

## Features

- **Infinite canvas** — zoom/pan with scroll + space-drag
- **6 shape tools** — Rectangle, Ellipse, Line, Arrow, Text, with full transform controls
- **Selection system** — click, multi-select (Shift), rubber-band drag select
- **Resize handles** — 8-point resize with Shift for aspect-ratio lock
- **Layers panel** — reorder, hide, lock elements
- **Properties inspector** — position, size, fill, stroke, opacity, typography
- **Undo/redo** — 60-step history stack (Command pattern)
- **Keyboard shortcuts** — full shortcut system (V H R E L A T, Ctrl+Z/Y/D/A, arrows, etc.)
- **Export** — SVG export + JSON save/load
- **Real-time multiplayer** — cursor presence + live sync via Liveblocks (optional)
- **Snap to grid** — toggle grid + snap

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + TypeScript | Industry standard, type safety |
| State | Zustand | Modern, minimal, no boilerplate |
| Rendering | HTML5 Canvas (2D) | 60fps, no DOM overhead |
| Multiplayer | Liveblocks | CRDT-based, free tier, 5-min setup |
| Styling | Tailwind CSS | Utility-first, no CSS files |
| Build | Vite | Fast HMR, instant builds |
| Deploy | Vercel | Zero-config, free |

## Getting Started

```bash
# Clone
git clone https://github.com/yourusername/chromacanvas
cd chromacanvas

# Install
npm install

# Dev server
npm run dev
```

Open http://localhost:5173

## Multiplayer Setup (Optional)

1. Create a free account at [liveblocks.io](https://liveblocks.io)
2. Create a project → copy your public key
3. Create `.env` from `.env.example`:
   ```
   VITE_LIVEBLOCKS_KEY=pk_your_key_here
   ```
4. In `src/components/Cursors.tsx`, uncomment the `LiveCursors` component
5. Wrap your app in `RoomProvider` (see `src/liveblocks.config.ts`)

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Hand / Pan tool |
| `R` | Rectangle |
| `E` | Ellipse |
| `L` | Line |
| `A` | Arrow |
| `T` | Text |
| `Del` | Delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+D` | Duplicate |
| `Ctrl+A` | Select all |
| `Ctrl+]` | Bring forward |
| `Ctrl+[` | Send backward |
| `Ctrl+Shift+E` | Export SVG |
| `0` | Reset zoom |
| `Scroll` | Zoom |
| `Space+drag` | Pan |
| `Arrows` | Nudge 1px |
| `Shift+Arrows` | Nudge 10px |
| `Shift+draw` | Constrain to square / aspect ratio |

## Deployment

```bash
# Build
npm run build

# Deploy to Vercel
npx vercel --prod
```

## Architecture

```
src/
├── components/
│   ├── Canvas.tsx          # Main canvas + RAF render loop
│   ├── Toolbar.tsx         # Top toolbar with tools + actions
│   ├── LayersPanel.tsx     # Left layers list
│   ├── PropertiesPanel.tsx # Right properties inspector
│   ├── ContextMenu.tsx     # Right-click context menu
│   ├── Cursors.tsx         # Multiplayer cursor overlay
│   └── Toast.tsx           # Notification toasts
├── store/
│   └── canvasStore.ts      # Zustand store (shapes, selection, viewport, history)
├── hooks/
│   ├── useCanvasInteraction.ts  # All mouse events (draw/drag/resize/pan)
│   └── useKeyboardShortcuts.ts  # Global keyboard bindings
├── utils/
│   ├── canvasRenderer.ts   # All canvas 2D drawing functions
│   ├── canvasGeometry.ts   # Hit testing, handles, coordinate math
│   └── exportUtils.ts      # SVG/PNG/JSON export
├── types/
│   └── index.ts            # All TypeScript types
└── liveblocks.config.ts    # Multiplayer config
```

## Roadmap

- [ ] Grouping (`Ctrl+G`)
- [ ] Image import (drag & drop)
- [ ] Gradient fill support
- [ ] Components panel (reusable elements)
- [ ] Variable font weight slider
- [ ] Bezier path tool
- [ ] Dark/light theme toggle
- [ ] Comments (Liveblocks threads)

## License

MIT
