import { AppProvider } from '@/components/shell/datasets-context'
import { AppShell } from '@/components/shell/sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  )
}
