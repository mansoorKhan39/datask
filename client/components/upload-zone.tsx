'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { uploadCsv } from '@/lib/api'
import type { DatasetSummary } from '@/lib/types'
import { cn, formatBytes } from '@/lib/utils'
import { useApp } from '@/components/shell/datasets-context'

const MAX = 4_000_000

export function UploadZone() {
  const router = useRouter()
  const { refresh } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState<{ name: string; pct: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handle(file: File | undefined) {
    if (!file || busy) return
    setError(null)
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) return setError('Please choose a CSV file (.csv).')
    if (file.size > MAX) return setError(`This file is ${formatBytes(file.size)}. The limit is about 4 MB. Try a smaller file or fewer columns.`)
    if (file.size === 0) return setError('This file is empty.')
    setBusy({ name: file.name, pct: 0 })
    try {
      const r = await uploadCsv<{ dataset: DatasetSummary }>('/datasets', file, (pct) => setBusy({ name: file.name, pct }))
      await refresh()
      toast.success(`${r.dataset.name} is ready`)
      router.push(`/app/d/${r.dataset.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]) }}
        className={cn(
          'relative grid min-h-[15rem] place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-card px-6 py-10 text-center transition-all',
          drag ? 'scale-[1.01] border-primary bg-primary-soft' : 'border-border hover:border-primary/50',
        )}
      >
        <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv" className="sr-only" id="file-input" onChange={(e) => handle(e.target.files?.[0])} disabled={!!busy} />
        {busy ? (
          <div className="w-full max-w-sm" role="status" aria-live="polite">
            <FileSpreadsheet size={34} className="mx-auto text-primary" aria-hidden="true" />
            <p className="mt-3 truncate font-semibold">{busy.name}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${busy.pct}%` }} /></div>
            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />{busy.pct < 100 ? `Uploading… ${busy.pct}%` : 'Reading your columns…'}
            </p>
          </div>
        ) : (
          <label htmlFor="file-input" className="flex cursor-pointer flex-col items-center">
            <span className={cn('grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary transition-transform', drag && '-translate-y-1')}><UploadCloud size={28} aria-hidden="true" /></span>
            <span className="mt-4 font-display text-2xl font-semibold">{drag ? 'Drop it here' : 'Drop a CSV file here'}</span>
            <span className="mt-1.5 text-muted-foreground">or <span className="font-semibold text-primary underline-offset-4 hover:underline">browse your computer</span></span>
            <span className="mt-3 text-sm text-muted-foreground">CSV up to about 4 MB, with a header row</span>
          </label>
        )}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
    </div>
  )
}
