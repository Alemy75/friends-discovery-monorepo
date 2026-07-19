import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** White surface, 24px radius, hairline border + whisper-quiet elevation. */
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-paper rounded-card border border-hairline shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('px-5 pt-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('px-5 pb-5', className)} {...props}>
      {children}
    </div>
  )
}
