import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'solid' | 'soft' | 'outline' | 'accent'

const variants: Record<Variant, string> = {
  solid: 'bg-ink-soft text-surface-alt',
  soft: 'bg-canvas text-ink-soft',
  outline: 'bg-transparent text-ink border border-hairline',
  accent: 'bg-accent-soft text-accent-ink',
}

interface BadgeProps {
  variant?: Variant
  className?: string
  children: ReactNode
}

/** Capsule tag — 18px radius, 12px/500 label. */
export function Badge({ variant = 'soft', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] font-medium leading-[1.33]',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
