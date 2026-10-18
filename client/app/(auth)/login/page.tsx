import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth-shell'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Log in' }

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your datasets and keep asking.">
      <AuthForm mode="login" />
    </AuthShell>
  )
}
