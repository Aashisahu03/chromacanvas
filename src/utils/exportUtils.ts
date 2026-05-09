import type { Shape } from '@/types'

// ─── SVG Export ───────────────────────────────────────────────────────────

export function exportSVG(shapes: Shape[], width = 1200, height = 800): string {
  const visibleShapes = shapes.filter((s) => !s.hidden)

  let svgContent = ''

  for (const s of visibleShapes) {
    const op = s.opacity ?? 1

    switch (s.type) {
      case 'rect': {
        const r = s.cornerRadius > 0 ? ` rx="${s.cornerRadius}"` : ''
        svgContent += `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"${r} fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${op}"/>\n`
        break
      }
      case 'ellipse': {
        svgContent += `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${Math.abs(s.w / 2)}" ry="${Math.abs(s.h / 2)}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${op}"/>\n`
        break
      }
      case 'line': {
        svgContent += `<line x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" opacity="${op}"/>\n`
        break
      }
      case 'arrow': {
        const angle = Math.atan2(s.y2 - s.y, s.x2 - s.x)
        const headLen = Math.max(12, s.strokeWidth * 4)
        const ax1 = s.x2 - headLen * Math.cos(angle - Math.PI / 6)
        const ay1 = s.y2 - headLen * Math.sin(angle - Math.PI / 6)
        const ax2 = s.x2 - headLen * Math.cos(angle + Math.PI / 6)
        const ay2 = s.y2 - headLen * Math.sin(angle + Math.PI / 6)
        svgContent += `<line x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" opacity="${op}"/>
<polyline points="${s.x2},${s.y2} ${ax1},${ay1}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" fill="none" opacity="${op}"/>
<polyline points="${s.x2},${s.y2} ${ax2},${ay2}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linecap="round" fill="none" opacity="${op}"/>\n`
        break
      }
      case 'text': {
        const style = `font-size:${s.fontSize}px;font-weight:${s.fontWeight};font-family:${s.fontFamily};font-style:${s.italic ? 'italic' : 'normal'}`
        const anchor = s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : 'start'
        const tx = s.textAlign === 'center' ? s.x + s.w / 2 : s.textAlign === 'right' ? s.x + s.w : s.x
        const lines = (s.text || '').split('\n')
        const lineH = s.fontSize * 1.35
        const tspans = lines
          .map((line, i) => `<tspan x="${tx}" dy="${i === 0 ? 0 : lineH}">${escapeXML(line)}</tspan>`)
          .join('')
        svgContent += `<text x="${tx}" y="${s.y + s.fontSize}" style="${style}" fill="${s.fill}" text-anchor="${anchor}" opacity="${op}">${tspans}</text>\n`
        break
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#111114"/>
${svgContent}</svg>`
}

function escapeXML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function downloadSVG(shapes: Shape[]) {
  const svg = exportSVG(shapes)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  triggerDownload(URL.createObjectURL(blob), 'chromacanvas.svg')
}

export async function downloadPNG(canvas: HTMLCanvasElement) {
  const dataUrl = canvas.toDataURL('image/png')
  triggerDownload(dataUrl, 'chromacanvas.png')
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

// ─── JSON Save/Load ───────────────────────────────────────────────────────

export function saveJSON(shapes: Shape[]) {
  const data = JSON.stringify({ version: '1.0', shapes }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  triggerDownload(URL.createObjectURL(blob), 'chromacanvas.json')
}

export function loadJSON(file: File): Promise<Shape[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        resolve(data.shapes || [])
      } catch {
        reject(new Error('Invalid file'))
      }
    }
    reader.readAsText(file)
  })
}
