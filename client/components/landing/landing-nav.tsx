'use client'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { LangSwitch } from '@/components/lang-switch'
import { ThemeToggle } from '@/components/theme-toggle'
import { useLang } from '@/lib/lang'

const T = {
  how: { en: 'How it works', roman: 'Yeh kaise chalta hai', ur: 'یہ کیسے کام کرتا ہے' },
  trust: { en: 'Why trust it', roman: 'Bharosa kyun', ur: 'بھروسہ کیوں' },
  faq: { en: 'Questions', roman: 'Sawalat', ur: 'سوالات' },
  login: { en: 'Log in', roman: 'Login', ur: 'لاگ ان' },
  start: { en: 'Start free', roman: 'Free shuru karein', ur: 'مفت شروع کریں' },
  startShort: { en: 'Start', roman: 'Shuru', ur: 'شروع' },
}

export function LandingNav() {
  const { lang } = useLang()
  const l = (k: keyof typeof T) => T[k][lang]
  const ur = lang === 'ur' ? 'ur' : undefined
  return (
    <header className="sticky top-3 z-50 px-3 pt-3 sm:px-5">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-2xl px-3 sm:px-4">
        <Link href="/" aria-label="Datask home" className="shrink-0"><Logo size={28} /></Link>
        <nav aria-label="Sections" lang={ur} className="hidden items-center gap-1 text-[14px] font-medium text-muted-foreground lg:flex">
          {([['#how', 'how'], ['#trust', 'trust'], ['#faq', 'faq']] as const).map(([href, k]) => (
            <a key={k} href={href} className="rounded-lg px-3.5 py-2 transition-colors hover:bg-primary-soft hover:text-primary">{l(k)}</a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <LangSwitch compact />
          <ThemeToggle />
          <Link href="/login" lang={ur} className="btn-ghost btn-sm hidden md:inline-flex">{l('login')}</Link>
          <Link href="/register" lang={ur} className="btn-gradient btn-sm"><span className="sm:hidden">{l('startShort')}</span><span className="hidden sm:inline">{l('start')}</span></Link>
        </div>
      </div>
    </header>
  )
}
