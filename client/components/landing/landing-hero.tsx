'use client'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useLang } from '@/lib/lang'
import { cn } from '@/lib/utils'
import { HeroDemo } from './hero-demo'

const T = {
  h1: { en: 'Ask your data. Get the answer and the chart.', roman: 'Apne data se poochiye. Jawab aur chart foran paiye.', ur: 'اپنے ڈیٹا سے پوچھیں۔ جواب اور چارٹ فوراً پائیں۔' },
  sub: {
    en: 'Upload a CSV, then ask in English, Roman Urdu or Urdu. Datask answers in one sentence, draws the chart and shows every step it took.',
    roman: 'CSV upload karein, phir English, Roman Urdu ya Urdu mein sawal poochein. Datask aik jumle mein jawab deta hai, chart banata hai aur har qadam dikhata hai.',
    ur: 'CSV اپ لوڈ کریں، پھر انگریزی، رومن اردو یا اردو میں سوال پوچھیں۔ Datask ایک جملے میں جواب دیتا ہے، چارٹ بناتا ہے اور ہر قدم دکھاتا ہے۔',
  },
  cta: { en: 'Try it with sample data', roman: 'Sample data se try karein', ur: 'نمونہ ڈیٹا کے ساتھ آزمائیں' },
  login: { en: 'Log in', roman: 'Login', ur: 'لاگ ان' },
  points: {
    en: ['Free to use', 'No code to write', 'Your file is never fully shared with the AI'],
    roman: ['Muft istemal', 'Code likhne ki zaroorat nahi', 'Aap ki file AI ko poori nahi milti'],
    ur: ['مفت استعمال', 'کوڈ لکھنے کی ضرورت نہیں', 'آپ کی فائل AI کو مکمل نہیں دی جاتی'],
  },
}

export function LandingHero() {
  const { lang, dir } = useLang()
  const ur = lang === 'ur'
  return (
    <section className="relative overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
        <div dir={dir} lang={ur ? 'ur' : undefined}>
          <p className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
            Data + Ask = Datask
          </p>
          <h1 className={cn('text-balance text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-[4.2rem]', ur && 'leading-[1.35] tracking-normal')}>
            {T.h1[lang]}
          </h1>
          <p className={cn('mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground', ur && 'leading-[2]')}>{T.sub[lang]}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/register" className="btn-gradient h-12 px-7 text-base">{T.cta[lang]}</Link>
            <Link href="/login" className="btn-soft h-12 px-7 text-base">{T.login[lang]}</Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {T.points[lang].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check size={15} className="text-primary" aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>
        <HeroDemo />
      </div>
    </section>
  )
}
