import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

/** Toggleable pill for selecting interests / intents. */
export function Chip({ selected, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-pill px-3 py-1.5 text-[13px] font-medium transition-colors',
        selected
          ? 'accent-gradient text-white shadow-[0_1px_2px_rgba(251,93,93,0.35)]'
          : 'bg-canvas text-ink-soft hover:bg-hairline',
        className,
      )}
    >
      {children}
    </button>
  )
}
