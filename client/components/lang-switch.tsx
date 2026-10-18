'use client'
import { Languages } from 'lucide-react'
import { LANGS, useLang } from '@/lib/lang'
import { cn } from '@/lib/utils'

/** Three-way language switch: English / Roman Urdu / Urdu. Compact on small screens. */
export function LangSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const { lang, setLang } = useLang()
  return (
    <div role="group" aria-label="Language" className={cn('inline-flex items-center rounded-xl border border-border/70 bg-muted/60 p-0.5 text-xs font-semibold backdrop-blur', className)}>
      {!compact && <Languages size={14} className="mx-1.5 hidden text-muted-foreground lg:block" aria-hidden="true" />}
      {LANGS.map((l) => (
        <button
          key={l.id} type="button" onClick={() => setLang(l.id)} aria-pressed={lang === l.id} title={l.label} lang={l.id === 'ur' ? 'ur' : undefined}
          className={cn('h-7 rounded-[9px] px-2.5 transition-all', lang === l.id ? 'bg-card text-primary shadow-sm glow-active' : 'text-muted-foreground hover:text-foreground')}
        >{compact && l.id === 'roman' ? (<><span className="sm:hidden">Ro</span><span className="hidden sm:inline">Roman</span></>) : l.short}</button>
      ))}
    </div>
  )
}
