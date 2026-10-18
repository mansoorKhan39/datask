import Link from 'next/link'
import { Suspense } from 'react'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

const EXAMPLES = [
  { l: 'English', q: 'Which product category sold the most?', dir: 'ltr' as const },
  { l: 'Roman Urdu', q: 'har mahine ki sales dikhao', dir: 'ltr' as const },
  { l: 'Urdu', q: 'کس شہر میں سب سے زیادہ آرڈر آئے؟', dir: 'rtl' as const },
]

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Datask home"><Logo /></Link>
          <ThemeToggle />
        </div>
        <main id="main" className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.04em]">{title}</h1>
          <p className="mb-7 mt-2 text-muted-foreground">{subtitle}</p>
          <div className="glass rounded-2xl p-6 sm:p-7"><Suspense fallback={<div className="skeleton h-72 w-full" />}>{children}</Suspense></div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground [background-image:linear-gradient(135deg,hsl(var(--primary)),hsl(178_80%_24%))] lg:block" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative flex h-full flex-col justify-center gap-10 px-16">
          <p className="max-w-sm font-display text-4xl font-semibold leading-tight">Your spreadsheet already knows the answer.</p>
          <ul className="max-w-md space-y-4">
            {EXAMPLES.map((x, n) => (
              <li key={x.l} className="animate-rise rounded-2xl bg-white/10 px-5 py-4 backdrop-blur" style={{ animationDelay: `${0.15 + n * 0.15}s` }}>
                <span className="text-xs font-semibold text-accent">{x.l}</span>
                <p dir={x.dir} lang={x.dir === 'rtl' ? 'ur' : undefined} className="mt-1 text-xl font-medium leading-snug">{x.q}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
