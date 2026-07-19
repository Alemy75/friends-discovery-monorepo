import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'filled' | 'ink' | 'inverse' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-pill transition-colors duration-150 select-none disabled:opacity-40 disabled:pointer-events-none focus-hairline whitespace-nowrap'

const variants: Record<Variant, string> = {
  // Coral gradient — the primary, energetic call to action.
  filled: 'accent-gradient text-white hover:opacity-95 shadow-[0_1px_2px_rgba(251,93,93,0.35)]',
  // Neutral dark fill for lower-key primary actions.
  ink: 'bg-ink text-surface-alt hover:bg-ink-soft',
  // White fill for use on top of the coral gradient.
  inverse: 'bg-white text-accent-ink hover:bg-white/90',
  // Soft gray tonal sibling to the primary.
  secondary: 'bg-canvas text-ink hover:bg-hairline',
  // Hairline boundary, transparent fill.
  outline: 'bg-transparent text-ink border border-hairline hover:bg-canvas',
  ghost: 'bg-transparent text-mid-gray hover:bg-canvas hover:text-ink',
  // Ember reserved exclusively for destructive intent.
  destructive: 'bg-transparent text-ember border border-hairline hover:bg-ember hover:text-paper',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-9 px-4 text-[14px]',
  lg: 'h-11 px-6 text-[14px]',
}

export function Button({
  variant = 'filled',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}
