import { cn } from '../../lib/utils'

/** Monochrome wordmark — two interlocking rings signal "connection" without color. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
        <circle cx="8" cy="11" r="5.25" stroke="var(--color-accent)" strokeWidth="1.7" />
        <circle cx="14" cy="11" r="5.25" stroke="var(--color-ink)" strokeWidth="1.6" />
      </svg>
      {!compact && (
        <span className="text-[16px] font-semibold tracking-[-0.02em] text-ink">
          friends<span className="text-accent-ink">.ai</span>
        </span>
      )}
    </span>
  )
}
