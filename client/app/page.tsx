import Link from 'next/link'
import { Check, Languages, ShieldCheck, Terminal } from 'lucide-react'
import { Logo } from '@/components/logo'
import { LandingNav } from '@/components/landing/landing-nav'
import { LandingHero } from '@/components/landing/landing-hero'

const FAQ = [
  { q: 'What kind of files can I upload?', a: 'CSV files up to about 4 MB, with a header row. Commas, semicolons and tabs are all fine. Numbers like “1,200” and dates in most formats are understood automatically.' },
  { q: 'Can the AI see all of my data?', a: 'It sees the column names, their types and a few example values so it can understand your question. It never gets the full file. Turn on privacy mode and it gets column names only.' },
  { q: 'Is the answer calculated or guessed?', a: 'Calculated. The AI only writes a small plan (for example “group by city, add up sales”). Our own code runs that plan on your file, so the numbers come from your data, and every step is shown under the answer.' },
  { q: 'Which languages can I ask in?', a: 'English, Roman Urdu (Urdu in English letters) and Urdu script. The answer comes back in the same language. You can also speak your question with the microphone button.' },
  { q: 'What does it cost?', a: 'The app is free to use. The daily question limit exists because the AI service behind it has a free plan with its own limits.' },
]

const STEPS = [
  { t: 'Drop in a CSV', d: 'Drag a file in, or try the built-in sample store data. Datask reads the columns and works out which ones are numbers, dates and categories.' },
  { t: 'Ask in your own words', d: 'Type or speak. “Which city sold the most last month?” or “har mahine ki sales dikhao”. Follow-up questions remember what you asked before.' },
  { t: 'Get the answer and the chart', d: 'One clear sentence, a chart you can switch between bar, line and pie, and the steps behind it. Download the chart as an image or the numbers as a CSV.' },
]

export default function Landing() {
  return (
    <div className="relative">
      <LandingNav />

      <main id="main">
        <LandingHero />

        {/* how it works */}
        <section id="how" className="scroll-mt-20 border-t border-border/60 bg-card/50 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <h2 className="max-w-xl text-balance text-4xl font-bold leading-[1.05] sm:text-5xl">From a file to an answer in three steps.</h2>
            <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 shadow-[0_24px_60px_-34px_hsl(var(--foreground)/0.4)] md:grid-cols-3">
              {STEPS.map((s, n) => (
                <li key={s.t} className="bg-card/80 p-7 backdrop-blur transition-colors hover:bg-primary-soft/70 sm:p-9">
                  <span className="font-display text-6xl font-bold leading-none text-primary/25">{n + 1}</span>
                  <h3 className="mt-6 text-2xl font-semibold">{s.t}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* trust */}
        <section id="trust" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 sm:py-28 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="text-balance text-4xl font-bold leading-[1.05] sm:text-5xl">Every answer shows its working.</h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
                You should never have to take a number on trust. Open “How Datask got this” under any answer and read exactly what was done to your file.
              </p>
              <dl className="mt-10 space-y-7">
                {[
                  { i: Terminal, t: 'The AI never runs code', d: 'It writes a small plan. Our own checked code runs it, so a strange question cannot do anything to your file or the server.' },
                  { i: ShieldCheck, t: 'Privacy mode', d: 'Switch it on and the AI sees column names only, not one value from your file.' },
                  { i: Languages, t: 'Built for Urdu too', d: 'Questions and answers in Urdu script display right to left with a proper Urdu font.' },
                ].map(({ i: Icon, t, d }) => (
                  <div key={t} className="flex gap-4 border-l-2 border-primary/30 pl-5">
                    <Icon size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    <div><dt className="font-semibold">{t}</dt><dd className="mt-1 text-muted-foreground">{d}</dd></div>
                  </div>
                ))}
              </dl>
            </div>

            <div className="glass self-start rounded-2xl p-6 sm:p-8">
              <p className="text-2xl font-semibold leading-snug">Which city had the highest sales last month?</p>
              <p className="mt-3 text-lg">Lahore had the highest sales last month: <strong>Rs 265,980</strong>.</p>
              <div className="mt-6 rounded-xl border border-border/50 bg-muted/60 p-5">
                <p className="text-sm font-semibold">How Datask got this</p>
                <ol className="mt-3 space-y-2.5 text-[15px]">
                  {['Started with 1,500 rows', 'Kept rows where order date is between 2026-09-01 and 2026-09-30 → 166 rows left', 'Grouped by city', 'Calculated sum of sales', 'Sorted by total sales (high to low)'].map((s, n) => (
                    <li key={s} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n + 1}</span><span className="text-muted-foreground">{s}</span></li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* languages */}
        <section className="border-t border-border/60 bg-card/50 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
            <h2 className="max-w-xl text-balance text-4xl font-bold leading-[1.05] sm:text-5xl">Ask the way you talk.</h2>
            <div className="mt-12 divide-y divide-border border-y border-border">
              {[
                { l: 'English', q: 'What is the average order value by payment method?', dir: 'ltr' as const },
                { l: 'Roman Urdu', q: 'pichle mahine ki sab se zyada sales kis shehar mein hui?', dir: 'ltr' as const },
                { l: 'Urdu', q: 'کس کیٹیگری میں سب سے زیادہ آرڈر آئے؟', dir: 'rtl' as const },
              ].map((x) => (
                <div key={x.l} className="grid items-baseline gap-2 py-6 sm:grid-cols-[9rem_1fr] sm:gap-8">
                  <span className="text-sm font-semibold text-primary">{x.l}</span>
                  <p dir={x.dir} lang={x.dir === 'rtl' ? 'ur' : undefined} className="font-display text-2xl font-medium leading-snug sm:text-3xl">{x.q}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* faq */}
        <section id="faq" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[1fr_1.5fr]">
            <h2 className="text-balance text-4xl font-bold leading-[1.05] sm:text-5xl">Questions people ask first.</h2>
            <div className="border-y border-border">
              {FAQ.map((f) => (
                <details key={f.q} className="group border-b border-border last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden="true" className="relative h-4 w-4 shrink-0 text-muted-foreground before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:bg-current after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:bg-current after:transition-transform group-open:after:scale-y-0" />
                  </summary>
                  <p className="max-w-prose pb-6 leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* closing */}
        <section className="relative overflow-hidden border-t border-border bg-primary text-primary-foreground [background-image:linear-gradient(120deg,hsl(var(--primary)),hsl(176_78%_26%))]">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 sm:flex-row sm:items-center sm:py-20">
            <h2 className="max-w-lg text-balance text-4xl font-bold leading-[1.05] sm:text-5xl">Your spreadsheet already knows the answer.</h2>
            <Link href="/register" className="btn h-12 shrink-0 bg-accent px-8 text-base text-accent-foreground hover:brightness-105">Create a free account</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <Logo size={24} className="text-foreground" />
          <nav aria-label="Account" className="flex gap-6">
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/register" className="hover:text-foreground">Create an account</Link>
            <span>© {new Date().getFullYear()} Datask</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
