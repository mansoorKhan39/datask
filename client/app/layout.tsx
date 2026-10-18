import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/noto-naskh-arabic'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: { default: 'Datask: ask your data anything', template: '%s · Datask' },
  description: 'Upload a CSV and ask questions in English, Roman Urdu or Urdu. Get the answer, a chart and the exact steps behind it.',
}

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#fcfdfd' }, { media: '(prefers-color-scheme: dark)', color: '#0d1117' }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
