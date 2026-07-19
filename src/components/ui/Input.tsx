import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const fieldBase =
  'w-full bg-canvas text-ink placeholder:text-mid-gray rounded-pill px-[10px] py-2 text-[14px] outline-none border border-transparent focus:bg-paper focus:border-hairline transition-colors'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, 'rounded-[14px] resize-none leading-[1.5]', className)}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="t-caption text-mid-gray">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-mid-gray">{hint}</span>}
    </label>
  )
}
