'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useApp } from '@/components/shell/datasets-context'

export default function SettingsPage() {
  const { user, usage } = useApp()
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState<'pw' | 'del' | null>(null)
  const [delPw, setDelPw] = useState('')
  const [err, setErr] = useState<{ pw?: string; del?: string }>({})

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setErr({}); setBusy('pw')
    try {
      await api('/auth/password', { json: { current, new: next } })
      toast.success('Password changed')
      setCurrent(''); setNext('')
    } catch (e) { setErr({ pw: (e as Error).message }) }
    setBusy(null)
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!window.confirm('Delete your account and all your datasets and chats? This cannot be undone.')) return
    setErr({}); setBusy('del')
    try {
      await api('/auth/delete-account', { json: { password: delPw } })
      router.replace('/')
      router.refresh()
    } catch (e) { setErr({ del: (e as Error).message }); setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <h1 className="font-display text-4xl font-bold">Account</h1>
      <dl className="mt-8 grid grid-cols-[7rem_1fr] gap-y-3 text-[15px]">
        <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{user?.name}</dd>
        <dt className="text-muted-foreground">Email</dt><dd className="font-medium">{user?.email}</dd>
        <dt className="text-muted-foreground">Questions</dt><dd className="font-medium">{usage ? `${usage.used} of ${usage.limit} used today` : '…'}</dd>
      </dl>

      <form onSubmit={changePassword} className="mt-12 space-y-4 border-t border-border pt-10">
        <h2 className="text-2xl font-semibold">Change password</h2>
        {err.pw && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">{err.pw}</p>}
        <div><label htmlFor="cur" className="mb-1.5 block text-sm font-medium">Current password</label><input id="cur" type="password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>
        <div><label htmlFor="new" className="mb-1.5 block text-sm font-medium">New password</label><input id="new" type="password" className="field" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /><p className="mt-1.5 text-sm text-muted-foreground">At least 8 characters, with letters and numbers.</p></div>
        <button className="btn-primary" disabled={busy === 'pw' || !current || !next}>{busy === 'pw' && <Loader2 size={17} className="animate-spin" />}Save new password</button>
      </form>

      <form onSubmit={deleteAccount} className="mt-12 space-y-4 border-t border-border pt-10">
        <h2 className="text-2xl font-semibold text-danger">Delete account</h2>
        <p className="text-muted-foreground">This permanently removes your account, every dataset you uploaded and all chat history.</p>
        {err.del && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">{err.del}</p>}
        <div><label htmlFor="dp" className="mb-1.5 block text-sm font-medium">Type your password to confirm</label><input id="dp" type="password" className="field" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoComplete="current-password" /></div>
        <button className="btn bg-danger text-white hover:brightness-110" disabled={busy === 'del' || !delPw}>{busy === 'del' && <Loader2 size={17} className="animate-spin" />}Delete my account</button>
      </form>
    </div>
  )
}
