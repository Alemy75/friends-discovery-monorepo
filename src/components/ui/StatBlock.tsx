import { cn } from '../../lib/utils'

interface StatBlockProps {
  label: string
  value: string | number
  hint?: string
  accent?: boolean
  className?: string
}

/** Large numeric metric — typographic scale alone, no card chrome. */
export function StatBlock({ label, value, hint, accent, className }: StatBlockProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="t-caption text-mid-gray">{label}</span>
      <span
        className={cn(
          'text-[30px] leading-[1.1] font-semibold tracking-[-0.025em]',
          accent ? 'text-accent-ink' : 'text-ink',
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[14px] text-mid-gray">{hint}</span>}
    </div>
  )
}
