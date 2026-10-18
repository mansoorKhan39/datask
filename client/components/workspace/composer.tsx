'use client'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowUp, Loader2, Mic, ShieldCheck, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useSpeech, type SpeechLang } from '@/lib/speech'
import { LANGS, useLang, type Lang } from '@/lib/lang'
import { cn } from '@/lib/utils'

export type ComposerHandle = { focus: () => void; setText: (t: string, append?: boolean) => void }

const PLACEHOLDERS: Record<Lang, string[]> = {
  en: ['Which city had the highest sales?', 'Average order value by payment method', 'Show total sales for each month'],
  roman: ['Kis shehar mein sab se zyada sales hui?', 'har mahine ki sales dikhao', 'Payment method ke hisaab se average order'],
  ur: ['کس شہر میں سب سے زیادہ فروخت ہوئی؟', 'ہر مہینے کی کل فروخت دکھاؤ', 'کس کیٹیگری کی فروخت سب سے زیادہ ہے؟'],
}
const VOICE: Record<Lang, SpeechLang> = { en: 'en-US', roman: 'en-IN', ur: 'ur-PK' }

type Props = { busy: boolean; remaining: number | null; privacy: boolean; onPrivacy: (v: boolean) => void; onSend: (text: string) => void }

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ busy, remaining, privacy, onPrivacy, onSend }, ref) {
  const [text, setText] = useState('')
  const { lang, setLang } = useLang()
  const [ph, setPh] = useState(0)
  const area = useRef<HTMLTextAreaElement>(null)
  const base = useRef('')
  const MAX = 500

  const speech = useSpeech(
    (t, final) => { setText((base.current ? base.current + ' ' : '') + t); if (final) base.current = '' },
    (m) => toast.error(m),
  )

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    setText: (t, append) => { setText((cur) => (append && cur ? `${cur} ${t}` : t)); setTimeout(() => area.current?.focus(), 0) },
  }))

  useEffect(() => { const id = setInterval(() => setPh((p) => p + 1), 4000); return () => clearInterval(id) }, [])

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }, [text])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); area.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function send() {
    const q = text.trim()
    if (!q || busy) return
    if (speech.listening) speech.stop()
    onSend(q)
    setText('')
  }

  const out = remaining !== null && remaining <= 0
  const canSend = text.trim().length > 1 && !busy && !out

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      <div className={cn('glass glow-focus-within rounded-2xl transition-all', speech.listening && 'border-danger shadow-[0_0_0_4px_hsl(var(--danger)/0.12)]')}>
        <label htmlFor="ask-input" className="sr-only">Ask a question about your data</label>
        <textarea
          id="ask-input" ref={area} dir="auto" rows={1} value={text} maxLength={MAX} disabled={out}
          onChange={(e) => { setText(e.target.value); base.current = '' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } if (e.key === 'Escape') (e.target as HTMLElement).blur() }}
          placeholder={out ? 'You have used all of today’s questions.' : speech.listening ? 'Listening…' : PLACEHOLDERS[lang][ph % PLACEHOLDERS[lang].length]}
          className="block max-h-[150px] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[17px] leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button" onClick={() => onPrivacy(!privacy)} aria-pressed={privacy}
              title="Privacy mode: the AI only sees column names, never values from your file"
              className={cn('flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors', privacy ? 'glow-active bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
            ><ShieldCheck size={17} /><span className="hidden sm:inline">Privacy mode{privacy ? ' on' : ''}</span></button>
            {speech.supported && (
              <>
                <button
                  type="button" onClick={() => (speech.listening ? speech.stop() : (base.current = text, speech.start(VOICE[lang])))}
                  aria-label={speech.listening ? 'Stop listening' : 'Speak your question'} aria-pressed={speech.listening}
                  className={cn('grid h-9 w-9 place-items-center rounded-lg transition-colors', speech.listening ? 'animate-pulse-ring bg-danger text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >{speech.listening ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}</button>
              </>
            )}
            <div role="group" aria-label="Question language" className="inline-flex rounded-lg border border-border/70 bg-muted/50 p-0.5 text-xs font-semibold">
              {LANGS.map((l) => (
                <button key={l.id} type="button" aria-pressed={lang === l.id} title={l.label} onClick={() => setLang(l.id)} disabled={speech.listening} className={cn('h-7 rounded-md px-2 transition-all', lang === l.id ? 'glow-active bg-card text-primary' : 'text-muted-foreground hover:text-foreground')}>{l.short}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground md:inline"><kbd className="kbd">/</kbd> focus · <kbd className="kbd">Enter</kbd> send</span>
            {text.length > MAX - 60 && <span className="font-mono text-xs text-muted-foreground">{MAX - text.length}</span>}
            <button type="button" onClick={send} disabled={!canSend} aria-label="Ask" className="btn-gradient grid h-10 w-10 place-items-center rounded-xl p-0 transition-all active:scale-95 disabled:!bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none">
              {busy ? <Loader2 size={19} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
      {remaining !== null && remaining <= 10 && remaining > 0 && <p className="mt-2 text-center text-xs text-muted-foreground">{remaining} question{remaining === 1 ? '' : 's'} left today.</p>}
    </div>
  )
})
