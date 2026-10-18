'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechLang = 'en-US' | 'en-IN' | 'ur-PK'

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean
  start(): void; stop(): void; abort(): void
  onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null
}

export function useSpeech(onText: (text: string, final: boolean) => void, onError: (message: string) => void) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const rec = useRef<Rec | null>(null)
  const cb = useRef({ onText, onError })
  cb.current = { onText, onError }

  useEffect(() => {
    const w = window as any
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => rec.current?.abort()
  }, [])

  const start = useCallback((lang: SpeechLang) => {
    const w = window as any
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return cb.current.onError('Voice input is not supported in this browser. Try Chrome or Edge.')
    const r: Rec = new Ctor()
    r.lang = lang
    r.interimResults = true
    r.continuous = false
    r.onresult = (e: any) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      cb.current.onText(text.trim(), e.results[e.results.length - 1].isFinal)
    }
    r.onerror = (e: any) => {
      const code = e?.error
      if (code === 'not-allowed' || code === 'service-not-allowed') cb.current.onError('Microphone access is blocked. Allow it in your browser settings and try again.')
      else if (code === 'no-speech') cb.current.onError('I did not hear anything. Try again.')
      else if (code !== 'aborted') cb.current.onError('Voice input stopped working. Please type your question instead.')
    }
    r.onend = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setListening(false) }
  }, [])

  const stop = useCallback(() => { rec.current?.stop() }, [])
  return { supported, listening, start, stop }
}
