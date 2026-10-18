import Link from 'next/link'
import { Logo } from '@/components/logo'

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <Logo className="mb-8" />
        <h1 className="font-display text-5xl font-bold">This page does not exist</h1>
        <p className="mt-3 text-muted-foreground">The link may be old, or the address was typed wrong.</p>
        <Link href="/" className="btn-primary mt-8">Go to the home page</Link>
      </div>
    </main>
  )
}
