/** Small circular gauge for a compatibility percentage. Monochrome. */
export function CompatRing({ value, size = 44 }: { value: number; size?: number }) {
  const stroke = 3
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - value / 100)
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-hairline)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-accent-ink">{value}</span>
    </div>
  )
}
