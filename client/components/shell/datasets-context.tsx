'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { DatasetSummary, Usage, User } from '@/lib/types'

type Ctx = {
  user: User | null
  datasets: DatasetSummary[]
  loaded: boolean
  usage: Usage | null
  setUsage: (u: Usage) => void
  refresh: () => Promise<void>
  remove: (id: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
}

const C = createContext<Ctx | null>(null)

export function useApp() {
  const v = useContext(C)
  if (!v) throw new Error('useApp must be used inside <AppProvider>')
  return v
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [datasets, setDatasets] = useState<DatasetSummary[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const [d, u] = await Promise.all([api<{ datasets: DatasetSummary[] }>('/datasets'), api<Usage>('/usage')])
    setDatasets(d.datasets)
    setUsage(u)
    setLoaded(true)
  }, [])

  useEffect(() => {
    api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => undefined)
    refresh().catch(() => setLoaded(true))
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await api(`/datasets/${id}`, { method: 'DELETE' })
    setDatasets((d) => d.filter((x) => x.id !== id))
  }, [])

  const rename = useCallback(async (id: string, name: string) => {
    const r = await api<{ dataset: DatasetSummary }>(`/datasets/${id}`, { method: 'PATCH', json: { name } })
    setDatasets((d) => d.map((x) => (x.id === id ? r.dataset : x)))
  }, [])

  const value = useMemo(() => ({ user, datasets, loaded, usage, setUsage, refresh, remove, rename }), [user, datasets, loaded, usage, refresh, remove, rename])
  return <C.Provider value={value}>{children}</C.Provider>
}
