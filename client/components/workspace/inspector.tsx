'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Hash, Loader2, Tags, ToggleLeft, Type, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { Kind, Preview, Profile } from '@/lib/types'
import { cn, formatNumber } from '@/lib/utils'
import { DataTable } from './data-table'

const ICON: Record<Kind, React.ReactNode> = {
  number: <Hash size={15} />, date: <CalendarDays size={15} />, category: <Tags size={15} />, text: <Type size={15} />, boolean: <ToggleLeft size={15} />,
}
const KIND_LABEL: Record<Kind, string> = { number: 'Number', date: 'Date', category: 'Category', text: 'Text', boolean: 'Yes / No' }

export function Inspector({ id, profile, onPick, onClose }: { id: string; profile: Profile; onPick: (name: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'columns' | 'preview'>('columns')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (offset: number) => {
    setLoading(true); setError(null)
    try {
      const p = await api<Preview>(`/datasets/${id}/preview?offset=${offset}&limit=100`)
      setPreview((cur) => (cur && offset > 0 ? { ...p, rows: [...cur.rows, ...p.rows] } : p))
    } catch (e) { setError((e as Error).message) }
    setLoading(false)
  }, [id])

  useEffect(() => { setPreview(null) }, [id])
  useEffect(() => { if (tab === 'preview' && !preview && !loading) load(0) }, [tab, preview, loading, load])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div role="tablist" aria-label="Data views" className="inline-flex rounded-lg bg-muted p-0.5">
          {(['columns', 'preview'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('h-8 rounded-md px-3.5 text-sm font-semibold capitalize transition-colors', tab === t ? 'glow-active bg-card text-primary' : 'text-muted-foreground hover:text-foreground')}>{t}</button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Close panel" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={18} /></button>
      </div>

      {tab === 'columns' ? (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto" role="tabpanel">
          {profile.columns.map((c) => (
            <li key={c.name}>
              <button type="button" onClick={() => onPick(c.name)} className="block w-full px-4 py-3 text-left transition-colors hover:bg-primary-soft/60" title="Click to add this column name to your question">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{ICON[c.kind]}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{KIND_LABEL[c.kind]}</span>
                </span>
                <span className="mt-1 block truncate pl-[23px] text-xs text-muted-foreground">
                  {c.kind === 'number' && c.stats ? `${formatNumber(c.stats.min as number)} to ${formatNumber(c.stats.max as number)} · average ${formatNumber(c.stats.mean as number)}` : null}
                  {c.kind === 'date' && c.stats ? `${c.stats.min} to ${c.stats.max}` : null}
                  {(c.kind === 'category' || c.kind === 'boolean') && c.top ? c.top.slice(0, 4).map((t) => (typeof t.value === 'boolean' ? (t.value ? 'Yes' : 'No') : String(t.value))).join(', ') + (c.unique > 4 ? ` +${c.unique - 4} more` : '') : null}
                  {c.kind === 'text' ? `${c.unique.toLocaleString()} different values` : null}
                </span>
                {c.nulls > 0 && (
                  <span className="mt-1.5 flex items-center gap-2 pl-[23px] text-xs text-muted-foreground">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-accent" style={{ width: `${Math.min(100, c.null_pct)}%` }} /></span>{c.null_pct}% empty
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3" role="tabpanel">
          {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {!preview && loading && <div className="space-y-2">{[0, 1, 2, 3, 4, 5].map((n) => <div key={n} className="skeleton h-9" />)}</div>}
          {preview && (
            <>
              <DataTable columns={preview.columns} rows={preview.rows} kinds={preview.kinds} maxHeight={9999} />
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Showing {preview.rows.length.toLocaleString()} of {preview.total.toLocaleString()} rows</span>
                {preview.rows.length < preview.total && (
                  <button onClick={() => load(preview.rows.length)} disabled={loading} className="btn-soft btn-sm">{loading && <Loader2 size={14} className="animate-spin" />}Load more</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
