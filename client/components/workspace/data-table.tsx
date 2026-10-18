import type { Kind } from '@/lib/types'
import { cn, formatNumber, nice } from '@/lib/utils'

type Cell = string | number | boolean | null

export function DataTable({ columns, rows, kinds, className, humanize = false, maxHeight = 360 }: { columns: string[]; rows: Cell[][]; kinds?: (Kind | null)[]; className?: string; humanize?: boolean; maxHeight?: number }) {
  const isNum = (i: number) => (kinds ? kinds[i] === 'number' : rows.slice(0, 20).some((r) => typeof r[i] === 'number'))
  return (
    <div className={cn('overflow-auto rounded-xl border border-border bg-card', className)} style={{ maxHeight }} tabIndex={0} role="region" aria-label="Data table">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {columns.map((c, i) => (
              <th key={c + i} scope="col" className={cn('whitespace-nowrap border-b border-border px-3.5 py-2.5 font-semibold', isNum(i) ? 'text-right' : 'text-left')}>{humanize ? nice(c) : c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-border/60 last:border-0 hover:bg-primary-soft/50">
              {r.map((v, ci) => (
                <td key={ci} dir="auto" className={cn('whitespace-nowrap px-3.5 py-2', isNum(ci) ? 'text-right font-mono tabular-nums' : 'text-left', v === null && 'text-muted-foreground/60')}>
                  {typeof v === 'number' ? formatNumber(v) : v === null ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
