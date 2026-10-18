'use client'
import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { LangProvider } from '@/lib/lang'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      position="bottom-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{ classNames: { toast: '!rounded-xl !border-border !font-sans' } }}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <LangProvider>{children}</LangProvider>
      <ThemedToaster />
    </ThemeProvider>
  )
}
