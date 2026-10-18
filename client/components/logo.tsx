import { useId } from 'react'
import { cn } from '@/lib/utils'

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const gid = 'dk' + useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className} style={{ filter: 'drop-shadow(0 4px 10px hsl(var(--primary) / 0.45))' }}>
      <defs>
        <linearGradient id={gid} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="hsl(var(--primary))" /><stop offset="1" stopColor="hsl(178 80% 30%)" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gid})`} />
      <path d="M9 12.5A3.5 3.5 0 0 1 12.5 9h15a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H19l-5.5 5v-5h-1A3.5 3.5 0 0 1 9 22.5z" fill="#fff" fillOpacity=".18" />
      <rect x="13" y="19" width="3.6" height="5" rx="1.2" fill="#fff" />
      <rect x="18.2" y="15" width="3.6" height="9" rx="1.2" fill="#fff" />
      <rect x="23.4" y="12" width="3.6" height="12" rx="1.2" fill="hsl(var(--accent))" />
    </svg>
  )
}

export function Logo({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className="text-[1.3rem] font-bold leading-none tracking-[-0.03em]">Datask</span>
    </span>
  )
}
