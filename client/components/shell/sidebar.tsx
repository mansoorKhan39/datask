'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Database, LogOut, Menu, MoreHorizontal, Pencil, Plus, Trash2, X, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useApp } from './datasets-context'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* desktop */}
      <aside className="hidden w-[17rem] shrink-0 border-r border-border/60 bg-card/60 backdrop-blur-xl lg:flex lg:flex-col"><SidebarBody /></aside>

      {/* mobile drawer */}
      {open && <div className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        id="mobile-nav"
        className={cn('fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl transition-transform duration-200 lg:hidden', open ? 'translate-x-0' : '-translate-x-full')}
        aria-hidden={!open}
        {...(!open ? { inert: '' as unknown as boolean } : {})}
      >
        <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><X size={18} /></button>
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-nav" className="grid h-10 w-10 place-items-center rounded-lg text-foreground hover:bg-muted"><Menu size={21} /></button>
          <Link href="/app" aria-label="Datask home"><Logo size={26} /></Link>
          <ThemeToggle />
        </div>
        <main id="main" className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

function SidebarBody() {
  const { datasets, loaded, usage, user, remove, rename } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const [menu, setMenu] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
    router.replace('/login')
    router.refresh()
  }

  async function commitRename(id: string, current: string) {
    const name = draft.trim()
    setEditing(null)
    if (!name || name === current) return
    try { await rename(id, name); toast.success('Renamed') } catch (e) { toast.error((e as Error).message) }
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`Delete “${name}” and its chat history? This cannot be undone.`)) return
    try {
      await remove(id)
      toast.success('Dataset deleted')
      if (pathname.includes(id)) router.replace('/app')
    } catch (e) { toast.error((e as Error).message) }
  }

  const pct = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0

  return (
    <>
      <div className="flex h-16 items-center px-5"><Link href="/app" aria-label="Datask home"><Logo /></Link></div>
      <div className="px-3">
        <Link href="/app" className="btn-gradient w-full"><Plus size={18} aria-hidden="true" />New dataset</Link>
      </div>

      <nav aria-label="Your datasets" className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">Your datasets</p>
        {!loaded && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="skeleton h-10" />)}</div>}
        {loaded && datasets.length === 0 && <p className="px-2 text-sm leading-relaxed text-muted-foreground">Nothing here yet. Upload a CSV or try the sample data.</p>}
        <ul className="space-y-0.5">
          {datasets.map((d) => {
            const active = pathname === `/app/d/${d.id}`
            return (
              <li key={d.id} className="relative">
                {editing === d.id ? (
                  <input
                    ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} aria-label="Dataset name"
                    onBlur={() => commitRename(d.id, d.name)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(d.id, d.name); if (e.key === 'Escape') setEditing(null) }}
                    className="field h-10 text-sm"
                  />
                ) : (
                  <div className={cn('group flex items-center rounded-xl transition-all', active ? 'glow-active bg-primary-soft text-primary' : 'hover:bg-muted/80')}>
                    <Link href={`/app/d/${d.id}`} aria-current={active ? 'page' : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-[14px]">
                      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', active ? 'bg-primary/15' : 'bg-muted')}><Database size={15} aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium leading-tight">{d.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" aria-hidden="true" />Ready · {d.rows.toLocaleString()} rows</span>
                      </span>
                    </Link>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenu(menu === d.id ? null : d.id) }}
                      aria-label={`Options for ${d.name}`} aria-haspopup="menu" aria-expanded={menu === d.id}
                      className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground opacity-100 hover:bg-card lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                    ><MoreHorizontal size={17} /></button>
                  </div>
                )}
                {menu === d.id && (
                  <div role="menu" className="absolute right-1 top-11 z-20 w-40 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-card">
                    <button role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted" onClick={() => { setMenu(null); setDraft(d.name); setEditing(d.id) }}><Pencil size={15} />Rename</button>
                    <button role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-danger/10" onClick={() => { setMenu(null); onDelete(d.id, d.name) }}><Trash2 size={15} />Delete</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-border/60 p-3">
        {usage && (
          <div className="mb-3 px-2" title="Questions left today. Resets at midnight UTC.">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>Daily plan</span><span className="font-medium text-foreground">{usage.remaining} question{usage.remaining === 1 ? '' : 's'} left</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={usage.used} aria-label="Questions used today">
              <div className={cn('h-full rounded-full transition-all', pct > 85 ? 'bg-danger' : 'bg-gradient-to-r from-primary to-[hsl(180_75%_40%)] shadow-[0_0_10px_hsl(var(--primary)/0.7)]')} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Link href="/app/settings" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted" aria-label="Account settings">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-[hsl(25_95%_55%)] text-sm font-bold text-accent-foreground">{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
            <span className="min-w-0 text-left"><span className="block truncate text-sm font-semibold">{user?.name ?? '…'}</span><span className="block truncate text-xs text-muted-foreground">{user?.email}</span></span>
          </Link>
          <Link href="/app/settings" aria-label="Settings" title="Settings" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Settings size={18} /></Link>
          <ThemeToggle className="hidden lg:grid" />
          <button onClick={logout} aria-label="Log out" title="Log out" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><LogOut size={18} /></button>
        </div>
      </div>
    </>
  )
}
