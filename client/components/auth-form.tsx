'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useId, useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const params = useSearchParams()
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const register = mode === 'register'
  const rules = [
    { ok: password.length >= 8, text: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), text: 'Letters and numbers' },
  ]
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim())
  const valid = emailOk && password.length > 0 && (!register || (name.trim().length > 0 && rules.every((r) => r.ok)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!valid) return
    setBusy(true)
    try {
      await api(register ? '/auth/register' : '/auth/login', { json: register ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password } })
      const next = params.get('next')
      router.replace(next && next.startsWith('/app') ? next : '/app')
      router.refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {params.get('expired') && !error && (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-primary-soft px-3.5 py-3 text-sm text-primary">Your session ended. Please log in again.</p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />{error}
        </p>
      )}

      {register && (
        <div>
          <label htmlFor={`${id}-name`} className="mb-1.5 block text-sm font-medium">Your name</label>
          <input id={`${id}-name`} className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} placeholder="Ayesha Khan" />
          {touched && !name.trim() && <p className="mt-1.5 text-sm text-danger">Enter your name.</p>}
        </div>
      )}

      <div>
        <label htmlFor={`${id}-email`} className="mb-1.5 block text-sm font-medium">Email</label>
        <input id={`${id}-email`} type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@example.com" />
        {touched && !emailOk && <p className="mt-1.5 text-sm text-danger">Enter a valid email address.</p>}
      </div>

      <div>
        <label htmlFor={`${id}-pw`} className="mb-1.5 block text-sm font-medium">Password</label>
        <div className="relative">
          <input
            id={`${id}-pw`} type={show ? 'text' : 'password'} className="field pr-12" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? 'new-password' : 'current-password'} maxLength={128} aria-describedby={register ? `${id}-rules` : undefined}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {register && (
          <ul id={`${id}-rules`} className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {rules.map((r) => (
              <li key={r.text} className={cn('flex items-center gap-1.5 transition-colors', r.ok ? 'text-primary' : 'text-muted-foreground')}>
                <Check size={14} className={cn('transition-opacity', r.ok ? 'opacity-100' : 'opacity-30')} aria-hidden="true" />{r.text}
              </li>
            ))}
          </ul>
        )}
        {touched && !register && !password && <p className="mt-1.5 text-sm text-danger">Enter your password.</p>}
      </div>

      <button type="submit" disabled={busy} className="btn-primary h-12 w-full text-base">
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
        {register ? (busy ? 'Creating your account…' : 'Create account') : busy ? 'Logging in…' : 'Log in'}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {register ? (<>Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Log in</Link></>) : (<>New to Datask? <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link></>)}
      </p>
    </form>
  )
}
