import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-hairline bg-paper text-ink shadow-card p-6 ${className}`}
      {...props}
    />
  );
}
