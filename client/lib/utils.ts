import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export function formatNumber(v: unknown, compact = false): string {
  if (typeof v !== 'number' || !isFinite(v)) return v == null ? '—' : String(v)
  if (compact) return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
  const abs = Math.abs(v)
  return new Intl.NumberFormat('en', { maximumFractionDigits: abs >= 100 ? 0 : 2 }).format(v)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Humanise a result column name: total_sales -> Total sales */
export function nice(label: string): string {
  const t = label.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export const hasArabicScript = (s: string) => /[؀-ۿ]/.test(s)
