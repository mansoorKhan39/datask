'use client'
import { useRef, useState } from 'react'
import { Check, ChevronDown, Clock, Copy, Download, ImageDown, Lightbulb, RotateCcw, Table2, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import type { Message } from '@/lib/types'
import { downloadChartPng, downloadCsv } from '@/lib/export'
import { cn, nice } from '@/lib/utils'
import { ChartView } from './chart-view'
import { DataTable } from './data-table'

export function QuestionLine({ text, onReuse }: { text: string; onReuse: (t: string) => void }) {
  return (
    <div className="group flex items-start justify-between gap-4">
      <h2 dir="auto" className="text-balance font-display text-2xl font-semibold leading-snug sm:text-[1.75rem]">{text}</h2>
      <button type="button" onClick={() => onReuse(text)} aria-label="Edit and ask again" title="Edit and ask again" className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground opacity-100 transition hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
        <RotateCcw size={16} />
      </button>
    </div>
  )
}

export function AnswerCard({ message, datasetName }: { message: Message; datasetName: string }) {
  const d = message.data
  const chartRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [steps, setSteps] = useState(false)
  const [plan, setPlan] = useState(false)
  const [copied, setCopied] = useState(false)
  const lang = d?.language === 'ur' ? 'ur' : undefined

  if (!d || d.kind === 'unanswerable') {
    return (
      <div className="glass flex gap-3.5 rounded-2xl p-5" role="status">
        <Lightbulb size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <p dir="auto" lang={lang} className="text-[17px] leading-relaxed">{message.content}</p>
          <p className="mt-2 text-sm text-muted-foreground">Tip: ask about the columns you can see on the right, for example “total sales by city”.</p>
        </div>
      </div>
    )
  }

  const chart = d.chart
  const res = d.result
  const hasTable = !!res && res.rows.length > 0
  const showChart = !!chart && chart.type !== 'table'
  const effectiveView = showChart ? view : 'table'

  async function copy() {
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { toast.error('Could not copy. Select the text and copy it instead.') }
  }

  async function png() {
    if (!chartRef.current) return
    try { await downloadChartPng(chartRef.current, d!.question) } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <article className="space-y-4" aria-label="Answer">
      <p dir="auto" lang={lang} className={cn('text-pretty text-xl leading-relaxed', d.language === 'ur' && 'leading-[2]')}>{message.content}</p>

      {(showChart || hasTable) && (
        <div className="glass animate-rise overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
            <p className="min-w-0 truncate text-sm font-semibold" dir="auto">{chart?.title || (res ? nice(res.columns[res.columns.length - 1]) : 'Result')}</p>
            <div className="flex items-center gap-1">
              {showChart && hasTable && (
                <div role="group" aria-label="View" className="mr-1 inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
                  <button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')} className={cn('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium', view === 'chart' ? 'glow-active bg-card text-primary' : 'text-muted-foreground hover:text-foreground')}><BarChart3 size={15} />Chart</button>
                  <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')} className={cn('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium', view === 'table' ? 'glow-active bg-card text-primary' : 'text-muted-foreground hover:text-foreground')}><Table2 size={15} />Table</button>
                </div>
              )}
              {hasTable && <button type="button" onClick={() => downloadCsv(res!.columns, res!.rows, d.question)} className="btn-ghost btn-sm" title="Download the numbers as CSV"><Download size={16} /><span className="hidden sm:inline">CSV</span></button>}
              {showChart && effectiveView === 'chart' && chart!.type !== 'number' && <button type="button" onClick={png} className="btn-ghost btn-sm" title="Download the chart as an image"><ImageDown size={16} /><span className="hidden sm:inline">PNG</span></button>}
            </div>
          </div>
          <div className="p-4">
            {effectiveView === 'chart' && chart ? <ChartView chart={chart} containerRef={chartRef} /> : hasTable && <DataTable columns={res!.columns} rows={res!.rows} humanize maxHeight={320} />}
            {res?.truncated && <p className="mt-2 text-xs text-muted-foreground">Showing {res.rows.length} of {res.row_count.toLocaleString()} rows.</p>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        {res && res.steps.length > 0 && (
          <button type="button" onClick={() => setSteps((s) => !s)} aria-expanded={steps} className={cn("btn-ghost btn-sm -ml-3 font-medium", steps && "bg-primary-soft text-primary")}>
            <ChevronDown size={16} className={cn('transition-transform', steps && 'rotate-180')} aria-hidden="true" />How Datask got this
          </button>
        )}
        <button type="button" onClick={copy} className="btn-ghost btn-sm font-medium">{copied ? <Check size={15} className="text-primary" /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy answer'}</button>
        {typeof d.ms === 'number' && <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><Clock size={13} aria-hidden="true" />{(d.ms / 1000).toFixed(1)}s</span>}
      </div>

      {steps && res && (
        <div className="glass animate-rise rounded-xl p-5">
          <ol className="space-y-2.5 text-[15px]">
            {res.steps.map((s, n) => (
              <li key={n} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n + 1}</span><span className="text-muted-foreground">{s}</span></li>
            ))}
          </ol>
          {d.plan && (
            <div className="mt-4 border-t border-border pt-3">
              <button type="button" onClick={() => setPlan((p) => !p)} aria-expanded={plan} className="text-sm font-medium text-primary hover:underline">{plan ? 'Hide the plan' : 'Show the plan the AI wrote'}</button>
              {plan && <pre dir="ltr" className="mt-3 max-h-64 overflow-auto rounded-lg bg-card p-3.5 font-mono text-xs leading-relaxed">{JSON.stringify(d.plan, null, 2)}</pre>}
            </div>
          )}
        </div>
      )}
      <span className="sr-only">Data from {datasetName}</span>
    </article>
  )
}
