type Cell = string | number | boolean | null

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCsv(columns: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return ''
    let s = String(v)
    // stop spreadsheet formula injection when the file is opened in Excel
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
}

export function downloadCsv(columns: string[], rows: Cell[][], name: string) {
  // BOM so Excel reads Urdu text correctly
  downloadBlob(new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }), `${slug(name)}.csv`)
}

// ASCII only: non-Latin filenames are mangled by some browsers/OSes
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'datask-' + new Date().toISOString().slice(0, 10)

/** Turn the chart's <svg> inside `root` into a PNG file. */
export async function downloadChartPng(root: HTMLElement, name: string) {
  const svg = root.querySelector('svg.recharts-surface') as SVGSVGElement | null
  if (!svg) throw new Error('No chart to export')
  const { width, height } = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--card').trim()
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', `hsl(${bg})`)
  clone.insertBefore(rect, clone.firstChild)
  clone.querySelectorAll('text').forEach((t) => t.setAttribute('font-family', 'system-ui, sans-serif'))
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Could not draw the chart')); img.src = url })
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(url)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Could not create the image')
  downloadBlob(blob, `${slug(name)}.png`)
}
