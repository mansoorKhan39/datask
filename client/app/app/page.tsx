'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Loader2, Sparkles, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { DatasetSummary } from '@/lib/types'
import { formatBytes, timeAgo } from '@/lib/utils'
import { UploadZone } from '@/components/upload-zone'
import { useApp } from '@/components/shell/datasets-context'

export default function AppHome() {
  const { user, datasets, loaded, refresh } = useApp()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function sample() {
    setBusy(true)
    try {
      const r = await api<{ dataset: DatasetSummary }>('/datasets/sample', { method: 'POST' })
      await refresh()
      router.push(`/app/d/${r.dataset.id}`)
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  const first = user?.name?.split(' ')[0]

  return (
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="text-balance font-display text-4xl font-bold leading-tight sm:text-5xl">{first ? `Hello, ${first}.` : 'Hello.'} What are we looking at?</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">Add a CSV file and start asking questions. Nothing to set up.</p>

      <div className="mt-9 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <UploadZone />
        <button
          onClick={sample} disabled={busy}
          className="group relative flex min-h-[15rem] flex-col justify-between overflow-hidden rounded-2xl bg-primary p-7 text-left text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          <span className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-accent/25 blur-2xl transition-transform group-hover:scale-125" aria-hidden="true" />
          <Sparkles size={26} className="text-accent" aria-hidden="true" />
          <span className="relative">
            <span className="block font-display text-2xl font-semibold leading-tight">No file handy? Try the sample store data.</span>
            <span className="mt-2 block text-sm opacity-80">1,500 orders across 7 cities and 12 months.</span>
            <span className="mt-4 inline-flex items-center gap-2 font-semibold">
              {busy ? <><Loader2 size={17} className="animate-spin" />Setting it up…</> : <>Open sample data <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></>}
            </span>
          </span>
        </button>
      </div>

      <section className="mt-14" aria-labelledby="recent">
        <h2 id="recent" className="text-xl font-semibold">Your datasets</h2>
        {!loaded && <div className="mt-4 space-y-2">{[0, 1].map((n) => <div key={n} className="skeleton h-16" />)}</div>}
        {loaded && datasets.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-10 text-center text-muted-foreground">
            <Table2 size={26} className="mx-auto mb-3 opacity-60" aria-hidden="true" />
            Your datasets will show up here after your first upload.
          </div>
        )}
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {datasets.map((d) => (
            <li key={d.id}>
              <Link href={`/app/d/${d.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Table2 size={19} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{d.name}</span>
                  <span className="block text-sm text-muted-foreground">{d.rows.toLocaleString()} rows · {d.cols} columns · {formatBytes(d.size)} · {timeAgo(d.created)}</span>
                </span>
                <ArrowRight size={18} className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
