import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth-shell'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Create an account' }

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle="Free to use. Upload a file or try the sample data in under a minute.">
      <AuthForm mode="register" />
    </AuthShell>
  )
}
