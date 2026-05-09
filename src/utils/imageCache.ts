// ─── Image cache — maps src → HTMLImageElement ────────────────────────────────
const cache = new Map<string, HTMLImageElement>()
const listeners = new Set<() => void>()

// Subscribe to be notified when any image finishes loading
export function onImageLoaded(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  listeners.forEach((fn) => fn())
}

export function getCachedImage(src: string): HTMLImageElement | null {
  return cache.get(src) ?? null
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (cache.has(src)) return Promise.resolve(cache.get(src)!)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      cache.set(src, img)
      notify()   // ← tell the canvas to re-render
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

// Pre-warm cache when a shape is added
export function preloadImage(src: string) {
  if (!cache.has(src)) loadImage(src).catch(() => {})
}