'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Eraser, PanelRight, RotateCcw, Sparkles } from 'lucide-react'
import { LogoMark } from '@/components/logo'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { DatasetSummary, Message, Profile, Usage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useApp } from '@/components/shell/datasets-context'
import { AnswerCard, QuestionLine } from '@/components/workspace/answer-card'
import { Composer, type ComposerHandle } from '@/components/workspace/composer'
import { Inspector } from '@/components/workspace/inspector'

type Detail = { dataset: DatasetSummary; profile: Profile; suggestions: string[] }
type Failure = { text: string; message: string }

const STAGES = ['Understanding your question…', 'Running the numbers…', 'Drawing the chart…']

function lsGet(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function lsSet(key: string, v: string) { try { localStorage.setItem(key, v) } catch { /* private mode */ } }

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const { id } = params
  const { usage, setUsage, rename } = useApp()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [stage, setStage] = useState(0)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [privacy, setPrivacy] = useState(false)
  const [panel, setPanel] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const composer = useRef<ComposerHandle>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // ---- load
  useEffect(() => {
    let alive = true
    setDetail(null); setMessages([]); setNotFound(false); setLoadError(null); setFailure(null); setPending(null)
    Promise.all([api<Detail>(`/datasets/${id}`), api<{ messages: Message[] }>(`/datasets/${id}/messages`)])
      .then(([d, m]) => { if (alive) { setDetail(d); setMessages(m.messages) } })
      .catch((e: unknown) => { if (!alive) return; if (e instanceof ApiError && e.status === 404) setNotFound(true); else setLoadError((e as Error).message) })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    setPrivacy(lsGet('datask:privacy') === '1')
    const saved = lsGet('datask:panel')
    setPanel(saved ? saved === '1' : window.matchMedia('(min-width: 1280px)').matches)
  }, [])
  const togglePanel = (v: boolean) => { setPanel(v); lsSet('datask:panel', v ? '1' : '0') }
  const togglePrivacy = (v: boolean) => { setPrivacy(v); lsSet('datask:privacy', v ? '1' : '0'); toast(v ? 'Privacy mode on. The AI sees column names only.' : 'Privacy mode off.') }

  // ---- progress text while waiting
  useEffect(() => {
    if (!pending) { setStage(0); return }
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1400)
    return () => clearInterval(t)
  }, [pending])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    bottom.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' })
  }, [messages.length, pending, failure])

  // ---- ask
  const ask = useCallback(async (text: string) => {
    setFailure(null)
    const tempId = `tmp-${Date.now()}`
    setMessages((m) => [...m, { id: tempId, role: 'user', content: text, data: null, created: new Date().toISOString() }])
    setPending(text)
    try {
      const r = await api<{ user_message: Message; message: Message; usage: Usage }>(`/datasets/${id}/ask`, { json: { question: text, privacy_mode: privacy } })
      setMessages((m) => [...m.filter((x) => x.id !== tempId), r.user_message, r.message])
      setUsage(r.usage)
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== tempId))
      setFailure({ text, message: (e as Error).message })
      if (e instanceof ApiError && e.code === 'daily_limit') api<Usage>('/usage').then(setUsage).catch(() => undefined)
    }
    setPending(null)
  }, [id, privacy, setUsage])

  async function clearChat() {
    if (!window.confirm('Clear the chat history for this dataset? Your data stays.')) return
    try { await api(`/datasets/${id}/messages`, { method: 'DELETE' }); setMessages([]); setFailure(null); toast.success('Chat cleared') } catch (e) { toast.error((e as Error).message) }
  }

  async function commitRename() {
    setEditing(false)
    const name = draft.trim()
    if (!detail || !name || name === detail.dataset.name) return
    try { await rename(id, name); setDetail({ ...detail, dataset: { ...detail.dataset, name } }) } catch (e) { toast.error((e as Error).message) }
  }

  // ---- states
  if (notFound) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-4xl font-bold">Dataset not found</h1>
          <p className="mt-3 text-muted-foreground">It may have been deleted, or the link is wrong.</p>
          <Link href="/app" className="btn-primary mt-7">Back to your datasets</Link>
        </div>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <AlertCircle size={34} className="mx-auto text-danger" aria-hidden="true" />
          <p className="mt-4 max-w-sm text-muted-foreground">{loadError}</p>
          <button onClick={() => location.reload()} className="btn-soft mt-6"><RotateCcw size={17} />Try again</button>
        </div>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-12" aria-busy="true" aria-label="Loading dataset">
        <div className="skeleton h-9 w-2/3" /><div className="skeleton h-5 w-1/3" /><div className="skeleton mt-8 h-40" />
      </div>
    )
  }

  const { dataset, profile, suggestions } = detail
  const remaining = usage ? usage.remaining : null

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="min-w-0">
            {editing ? (
              <input
                autoFocus value={draft} maxLength={80} aria-label="Dataset name" onChange={(e) => setDraft(e.target.value)} onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false) }}
                className="field h-9 max-w-xs font-display text-lg font-semibold"
              />
            ) : (
              <button onClick={() => { setDraft(dataset.name); setEditing(true) }} title="Click to rename" className="block max-w-full truncate rounded-md text-left font-display text-lg font-semibold hover:text-primary">{dataset.name}</button>
            )}
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" aria-hidden="true" />Ready</span>{dataset.rows.toLocaleString()} rows · {dataset.cols} columns</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && <button onClick={clearChat} className="btn-ghost btn-sm" title="Clear chat"><Eraser size={17} /><span className="hidden md:inline">Clear chat</span></button>}
            <button onClick={() => togglePanel(!panel)} aria-pressed={panel} className={cn('btn-sm btn-ghost', panel && 'glow-active bg-primary-soft text-primary hover:bg-primary-soft')} title="Columns and data"><PanelRight size={18} /><span className="hidden md:inline">Columns</span></button>
          </div>
        </header>

        {/* feed */}
        <div className="min-h-0 flex-1 overflow-y-auto" role="log" aria-live="polite" aria-label="Conversation">
          <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
            {messages.length === 0 && !pending && !failure && (
              <div className="glass animate-rise relative overflow-hidden rounded-3xl p-6 sm:mt-8 sm:p-10">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
                <LogoMark size={44} />
                <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-5xl"><span className="text-gradient">Datask:</span> Ask your data anything</h1>
                <p className="mt-4 max-w-xl text-lg text-muted-foreground">Ask in English, Roman Urdu or Urdu. Pick a suggestion below or type your own.</p>
                <ul className="relative mt-8 flex flex-wrap gap-2.5">
                  {suggestions.map((s, n) => (
                    <li key={s} className="animate-rise" style={{ animationDelay: `${n * 60}ms` }}>
                      <button type="button" onClick={() => ask(s)} disabled={remaining === 0} dir="auto" className="chip text-[15px]"><Sparkles size={14} className="text-accent" aria-hidden="true" />{s}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-10">
              {messages.map((m, n) => m.role === 'user' ? (
                <section key={m.id} className={cn('animate-rise', n > 0 && 'border-t border-border pt-10')}>
                  <QuestionLine text={m.content} onReuse={(t) => composer.current?.setText(t)} />
                  <div className="mt-5">
                    {messages[n + 1]?.role === 'assistant' ? <AnswerCard message={messages[n + 1]} datasetName={dataset.name} /> : null}
                  </div>
                </section>
              ) : null)}

              {pending && (
                <div className="space-y-4" role="status" aria-live="polite">
                  <p className="flex items-center gap-2.5 text-[15px] text-muted-foreground"><Sparkles size={16} className="animate-pulse text-accent" aria-hidden="true" />{STAGES[stage]}</p>
                  <div className="skeleton h-6 w-4/5" /><div className="skeleton h-56 w-full" />
                </div>
              )}

              {failure && (
                <div className="animate-rise rounded-2xl border border-danger/30 bg-danger/10 p-5" role="alert">
                  <p className="flex items-start gap-2.5 text-[15px]"><AlertCircle size={19} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />{failure.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-soft btn-sm" onClick={() => ask(failure.text)}><RotateCcw size={15} />Try again</button>
                    <button className="btn-ghost btn-sm" onClick={() => { composer.current?.setText(failure.text); setFailure(null) }}>Edit question</button>
                  </div>
                </div>
              )}
            </div>
            <div ref={bottom} className="h-2" />
          </div>
        </div>

        <div className="shrink-0 bg-gradient-to-t from-background via-background to-transparent pt-2">
          <Composer ref={composer} busy={!!pending} remaining={remaining} privacy={privacy} onPrivacy={togglePrivacy} onSend={ask} />
        </div>
      </div>

      {/* inspector: side column on wide screens, overlay on small ones */}
      {panel && (
        <>
          <div className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm xl:hidden" onClick={() => togglePanel(false)} aria-hidden="true" />
          <aside aria-label="Columns and data" className="fixed inset-y-0 right-0 z-40 w-[min(24rem,92vw)] border-l border-border/60 bg-card/90 shadow-2xl backdrop-blur-xl xl:static xl:z-auto xl:w-[22rem] xl:shrink-0 xl:shadow-none">
            <Inspector id={id} profile={profile} onClose={() => togglePanel(false)} onPick={(name) => composer.current?.setText(name, true)} />
          </aside>
        </>
      )}
    </div>
  )
}
