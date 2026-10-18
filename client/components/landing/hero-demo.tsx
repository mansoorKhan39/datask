'use client'
import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLang } from '@/lib/lang'

type Scene = {
  lang: string
  dir: 'ltr' | 'rtl'
  q: string
  answer: string
  kind: 'bars' | 'line'
  bars?: { label: string; value: number; text: string }[]
  line?: { label: string; value: number }[]
  steps: string[]
}

const SCENES: Scene[] = [
  {
    lang: 'English', dir: 'ltr',
    q: 'Which city had the highest sales last month?',
    answer: 'Lahore had the highest sales last month: Rs 265,980.',
    kind: 'bars',
    bars: [
      { label: 'Lahore', value: 266, text: '266k' }, { label: 'Karachi', value: 241, text: '241k' }, { label: 'Islamabad', value: 152, text: '152k' },
      { label: 'Faisalabad', value: 98, text: '98k' }, { label: 'Peshawar', value: 74, text: '74k' },
    ],
    steps: ['Kept September orders', 'Grouped by city', 'Added up sales', 'Sorted high to low'],
  },
  {
    lang: 'Roman Urdu', dir: 'ltr',
    q: 'kis category ki average sale sab se zyada hai?',
    answer: 'Electronics ki average sale sab se zyada hai: Rs 9,410.',
    kind: 'bars',
    bars: [
      { label: 'Electronics', value: 94, text: '9.4k' }, { label: 'Home', value: 61, text: '6.1k' }, { label: 'Fashion', value: 50, text: '5.0k' },
      { label: 'Beauty', value: 24, text: '2.4k' }, { label: 'Grocery', value: 22, text: '2.2k' },
    ],
    steps: ['Grouped by category', 'Averaged sales', 'Sorted high to low'],
  },
  {
    lang: 'اردو', dir: 'rtl',
    q: 'ہر مہینے کی کل فروخت دکھاؤ',
    answer: 'سب سے زیادہ فروخت اکتوبر میں ہوئی: 820,000 روپے۔',
    kind: 'line',
    line: [
      { label: 'May', value: 38 }, { label: 'Jun', value: 45 }, { label: 'Jul', value: 41 }, { label: 'Aug', value: 56 },
      { label: 'Sep', value: 62 }, { label: 'Oct', value: 82 },
    ],
    steps: ['Grouped by month', 'Added up sales', 'Sorted by date'],
  },
]

type Phase = 'typing' | 'thinking' | 'answer' | 'leaving'

export function HeroDemo() {
  const [i, setI] = useState(0)
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const [still, setStill] = useState(false)
  const timers = useRef<number[]>([])
  const scene = SCENES[i]
  const { lang } = useLang()
  useEffect(() => { setI(lang === 'en' ? 0 : lang === 'roman' ? 1 : 2) }, [lang])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setStill(true); setTyped(SCENES[0].q.length); setPhase('answer') }
  }, [])

  useEffect(() => {
    if (still) return
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    clear()
    setTyped(0); setPhase('typing')
    const len = scene.q.length
    for (let n = 1; n <= len; n++) later(() => setTyped(n), 350 + n * 42)
    const doneTyping = 350 + len * 42
    later(() => setPhase('thinking'), doneTyping + 250)
    later(() => setPhase('answer'), doneTyping + 1000)
    later(() => setPhase('leaving'), doneTyping + 1000 + 5200)
    later(() => setI((v) => (v + 1) % SCENES.length), doneTyping + 1000 + 5600)
    return clear
  }, [i, still, scene.q.length])

  const shown = still ? scene.q : scene.q.slice(0, typed)
  const showAnswer = phase === 'answer' || phase === 'leaving'
  const max = Math.max(...(scene.bars ?? []).map((b) => b.value), 1)

  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_70%_30%,hsl(var(--primary)/0.22),transparent_70%)]" aria-hidden="true" />
      <div className="glass overflow-hidden rounded-2xl shadow-pop" role="img" aria-label="Animated example: a question typed in English, Roman Urdu and Urdu, each answered with a short sentence and a chart.">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-2.5 text-[13px]">
          <span className="truncate font-mono text-muted-foreground">online_store_sales.csv</span>
          <span className="hidden text-muted-foreground sm:inline">1,500 rows · sample data</span>
        </div>

        <div className="min-h-[430px] p-5 sm:p-7" aria-hidden="true">
          <div className="mb-1 flex items-center justify-between">
            <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{scene.lang}</span>
          </div>
          <p dir={scene.dir} lang={scene.dir === 'rtl' ? 'ur' : undefined} className={cn('min-h-[3.4rem] text-[1.55rem] font-semibold leading-tight tracking-[-0.03em] sm:text-3xl', scene.dir === 'rtl' && 'font-sans leading-[1.7]')}>
            {shown}
            {phase === 'typing' && !still && <span className="ml-0.5 inline-block h-[1.1em] w-[3px] translate-y-[3px] animate-pulse bg-primary align-baseline" />}
          </p>

          <div className="mt-6 min-h-[260px]">
            {phase === 'thinking' && (
              <div className="animate-rise space-y-3">
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles size={15} className="animate-pulse text-accent" /> Reading your data…</p>
                <div className="skeleton h-5 w-3/4" /><div className="skeleton h-28 w-full" />
              </div>
            )}

            {showAnswer && (
              <div className={cn('transition-opacity duration-300', phase === 'leaving' ? 'opacity-0' : 'opacity-100')}>
                <p dir={scene.dir} lang={scene.dir === 'rtl' ? 'ur' : undefined} className={cn('animate-rise text-lg font-medium', scene.dir === 'rtl' && 'leading-[1.9]')}>{scene.answer}</p>

                {scene.kind === 'bars' && (
                  <ul className="mt-5 space-y-2.5">
                    {scene.bars!.map((b, n) => (
                      <li key={b.label} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3 text-sm">
                        <span className="truncate text-muted-foreground">{b.label}</span>
                        <span className="h-6 rounded-md bg-muted">
                          <span
                            className={cn('block h-full origin-left rounded-md', n === 0 ? 'bg-accent' : 'bg-primary/80')}
                            style={{ width: `${(b.value / max) * 100}%`, animation: `grow-x 0.7s cubic-bezier(.2,.8,.2,1) ${0.15 + n * 0.09}s both` }}
                          />
                        </span>
                        <span className="text-right font-mono text-xs text-muted-foreground">{b.text}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {scene.kind === 'line' && <MiniLine points={scene.line!} />}

                <ul className="mt-5 flex flex-wrap gap-2">
                  {scene.steps.map((s, n) => (
                    <li key={s} className="animate-rise rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground" style={{ animationDelay: `${0.6 + n * 0.12}s` }}>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniLine({ points }: { points: { label: string; value: number }[] }) {
  const w = 440, h = 150, pad = 8
  const max = Math.max(...points.map((p) => p.value))
  const xy = points.map((p, n) => [pad + (n * (w - pad * 2)) / (points.length - 1), h - pad - 18 - (p.value / max) * (h - pad * 2 - 24)] as const)
  const d = xy.map(([x, y], n) => `${n ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" style={{ direction: "ltr" }}>
      <path d={`${d} L${xy[xy.length - 1][0]} ${h - 18} L${xy[0][0]} ${h - 18} Z`} fill="hsl(var(--primary) / 0.12)" style={{ animation: 'rise 0.8s 0.5s both' }} />
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" style={{ animation: 'dash 1.2s ease-out both' }} />
      {xy.map(([x, y], n) => (
        <g key={n}>
          <circle cx={x} cy={y} r={n === xy.length - 1 ? 6 : 3.5} fill={n === xy.length - 1 ? 'hsl(var(--accent))' : 'hsl(var(--card))'} stroke="hsl(var(--primary))" strokeWidth="2" style={{ animation: `rise 0.4s ${0.9 + n * 0.1}s both` }} />
          <text x={x} y={h - 3} textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">{points[n].label}</text>
        </g>
      ))}
      <style>{`@keyframes dash{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}`}</style>
    </svg>
  )
}
