'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react'
import type { Chart, ChartType } from '@/lib/types'
import { cn, formatNumber, nice } from '@/lib/utils'

export function useChartColors() {
  const { resolvedTheme } = useTheme()
  const [c, setC] = useState({ series: ['#0a6a4b', '#f5a60a', '#4a55c9', '#e2573c', '#1596c4', '#a64da6'], grid: '#dfe6e2', text: '#5a6b64', card: '#ffffff', accent: '#f5a60a' })
  useEffect(() => {
    const s = getComputedStyle(document.documentElement)
    const v = (n: string) => `hsl(${s.getPropertyValue(`--${n}`).trim()})`
    setC({ series: [1, 2, 3, 4, 5, 6].map((i) => v(`c${i}`)), grid: v('grid'), text: v('muted-foreground'), card: v('card'), accent: v('accent') })
  }, [resolvedTheme])
  return c
}

export function usePrefersReducedMotion() {
  const [r, setR] = useState(false)
  useEffect(() => { setR(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  return r
}

function CountUp({ value }: { value: number }) {
  const reduce = usePrefersReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (reduce) { setN(value); return }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900)
      setN(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])
  const decimals = Number.isInteger(value) ? 0 : 2
  return <>{new Intl.NumberFormat('en', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n)}</>
}

const SWITCH_ICON: Record<string, React.ReactNode> = { bar: <BarChart3 size={15} />, line: <LineIcon size={15} />, pie: <PieIcon size={15} /> }

type Props = { chart: Chart; containerRef?: React.RefObject<HTMLDivElement> }

export function ChartView({ chart, containerRef }: Props) {
  const colors = useChartColors()
  const reduce = usePrefersReducedMotion()
  const gid = useId().replace(/:/g, '')
  const [type, setType] = useState<ChartType>(chart.type)
  useEffect(() => setType(chart.type), [chart])

  const inner = useMemo(() => {
    if (chart.type === 'number') return null
    if (chart.type === 'table') return null
    return chart
  }, [chart])

  if (chart.type === 'number') {
    return (
      <div className="py-6 text-center" ref={containerRef}>
        <p className="font-display text-6xl font-bold tracking-tight text-primary sm:text-7xl"><CountUp value={chart.value} /></p>
        <p className="mt-2 text-muted-foreground">{nice(chart.label)}</p>
      </div>
    )
  }
  if (!inner) return null

  const { data, series, x } = inner
  const many = data.length > 10
  const longLabels = data.some((d) => String(d.x ?? '').length > 9)
  const horizontal = type === 'bar' && series.length === 1 && !many && longLabels
  const tick = { fontSize: 12, fill: colors.text }
  const label = (v: unknown) => { const s = String(v ?? ''); return s.length > 14 ? s.slice(0, 13) + '…' : s }
  const anim = !reduce

  const tooltip = (
    <Tooltip
      cursor={{ fill: colors.grid, fillOpacity: 0.35 }}
      content={({ active, payload, label: l }) => active && payload?.length ? (
        <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm shadow-card">
          <p className="mb-1 font-semibold">{String(l ?? payload[0]?.payload?.x ?? '')}</p>
          {payload.map((p) => (
            <p key={String(p.dataKey)} className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: (p.color || p.payload?.fill) as string }} />
              {series.length > 1 || type === 'scatter' ? `${nice(String(p.name ?? p.dataKey))}: ` : ''}<span className="font-mono font-semibold text-foreground">{formatNumber(p.value as number)}</span>
            </p>
          ))}
        </div>
      ) : null}
    />
  )

  let body: React.ReactNode
  if (type === 'pie') {
    const key = series[0]
    body = (
      <PieChart>
        <Pie data={data} dataKey={key} nameKey="x" innerRadius="52%" outerRadius="86%" paddingAngle={2} stroke={colors.card} strokeWidth={2} isAnimationActive={anim}>
          {data.map((_, n) => <Cell key={n} fill={colors.series[n % colors.series.length]} />)}
        </Pie>
        {tooltip}
        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" formatter={(v) => <span className="text-sm text-foreground">{label(v)}</span>} />
      </PieChart>
    )
  } else if (type === 'scatter') {
    body = (
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name={x} tick={tick} tickFormatter={(v) => formatNumber(v, true)} stroke={colors.grid} />
        <YAxis type="number" dataKey="y" name={series[0]} tick={tick} tickFormatter={(v) => formatNumber(v, true)} stroke={colors.grid} width={56} />
        {tooltip}
        <Scatter data={data} fill={colors.series[0]} isAnimationActive={anim} />
      </ScatterChart>
    )
  } else if (type === 'line') {
    const single = series.length === 1
    body = single ? (
      <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.series[0]} stopOpacity={0.35} /><stop offset="100%" stopColor={colors.series[0]} stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={tick} tickFormatter={label} stroke={colors.grid} tickLine={false} minTickGap={24} />
        <YAxis tick={tick} tickFormatter={(v) => formatNumber(v, true)} stroke="transparent" width={52} />
        {tooltip}
        <Area type="monotone" dataKey={series[0]} stroke={colors.series[0]} strokeWidth={3} fill={`url(#${gid})`} dot={data.length <= 24 ? { r: 3.5, fill: colors.card, strokeWidth: 2 } : false} activeDot={{ r: 6, fill: colors.accent }} isAnimationActive={anim} />
      </AreaChart>
    ) : (
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={tick} tickFormatter={label} stroke={colors.grid} tickLine={false} minTickGap={24} />
        <YAxis tick={tick} tickFormatter={(v) => formatNumber(v, true)} stroke="transparent" width={52} />
        {tooltip}
        <Legend iconType="circle" formatter={(v) => <span className="text-sm text-foreground">{nice(String(v))}</span>} />
        {series.map((s, n) => <Line key={s} type="monotone" dataKey={s} stroke={colors.series[n % colors.series.length]} strokeWidth={3} dot={false} isAnimationActive={anim} />)}
      </LineChart>
    )
  } else if (horizontal) {
    const hi = inner.highlight ?? 0
    body = (
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barCategoryGap="22%">
        <CartesianGrid stroke={colors.grid} horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tick={tick} tickFormatter={(v) => formatNumber(v, true)} stroke={colors.grid} />
        <YAxis type="category" dataKey="x" tick={{ ...tick, fill: 'currentColor' }} tickFormatter={label} width={96} stroke="transparent" tickLine={false} />
        {tooltip}
        <Bar dataKey={series[0]} radius={[0, 8, 8, 0]} isAnimationActive={anim}>
          {data.map((_, n) => <Cell key={n} fill={hi && n < hi ? colors.accent : colors.series[0]} />)}
        </Bar>
      </BarChart>
    )
  } else {
    const hi = inner.highlight ?? 0
    body = (
      <BarChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 0 }} barCategoryGap="20%">
        <CartesianGrid stroke={colors.grid} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="x" tick={tick} tickFormatter={label} stroke={colors.grid} tickLine={false} interval={many ? 'preserveStartEnd' : 0} minTickGap={12} />
        <YAxis tick={tick} tickFormatter={(v) => formatNumber(v, true)} stroke="transparent" width={52} />
        {tooltip}
        {series.length > 1 && <Legend iconType="circle" formatter={(v) => <span className="text-sm text-foreground">{nice(String(v))}</span>} />}
        {series.map((s, n) => (
          <Bar key={s} dataKey={s} radius={[7, 7, 0, 0]} fill={colors.series[n % colors.series.length]} isAnimationActive={anim}>
            {series.length === 1 && hi > 0 ? data.map((_, i) => <Cell key={i} fill={i < hi ? colors.accent : colors.series[0]} />) : null}
          </Bar>
        ))}
      </BarChart>
    )
  }

  const switchable = inner.can_switch?.filter((t) => ['bar', 'line', 'pie'].includes(t)) ?? []

  return (
    <div>
      {switchable.length > 1 && (
        <div className="mb-2 flex justify-end">
          <div role="group" aria-label="Chart type" className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
            {switchable.map((t) => (
              <button
                key={t} type="button" onClick={() => setType(t)} aria-pressed={type === t} aria-label={`${t} chart`}
                className={cn('flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium capitalize transition-colors', type === t ? 'glow-active bg-card text-primary' : 'text-muted-foreground hover:text-foreground')}
              >{SWITCH_ICON[t]}{t}</button>
            ))}
          </div>
        </div>
      )}
      <div key={type} ref={containerRef} className="animate-chart-in text-foreground" style={{ height: type === 'pie' ? 300 : horizontal ? Math.max(220, data.length * 44 + 40) : 300 }}>
        <ResponsiveContainer width="100%" height="100%">{body as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
}
