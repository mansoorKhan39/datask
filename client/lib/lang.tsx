'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Lang = 'en' | 'roman' | 'ur'
export const LANGS: { id: Lang; short: string; label: string }[] = [
  { id: 'en', short: 'EN', label: 'English' },
  { id: 'roman', short: 'Roman', label: 'Roman Urdu' },
  { id: 'ur', short: 'اردو', label: 'Urdu' },
]

type Ctx = { lang: Lang; setLang: (l: Lang) => void; dir: 'ltr' | 'rtl' }
const LangContext = createContext<Ctx>({ lang: 'en', setLang: () => undefined, dir: 'ltr' })

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, set] = useState<Lang>('en')
  useEffect(() => {
    try { const v = localStorage.getItem('datask:lang'); if (v === 'en' || v === 'roman' || v === 'ur') set(v) } catch { /* private mode */ }
  }, [])
  const setLang = useCallback((l: Lang) => { set(l); try { localStorage.setItem('datask:lang', l) } catch { /* ignore */ } }, [])
  const value = useMemo(() => ({ lang, setLang, dir: (lang === 'ur' ? 'rtl' : 'ltr') as 'ltr' | 'rtl' }), [lang, setLang])
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)

/** Pick the string for the current language. */
export function pick<T>(lang: Lang, v: { en: T; roman: T; ur: T }): T { return v[lang] }
