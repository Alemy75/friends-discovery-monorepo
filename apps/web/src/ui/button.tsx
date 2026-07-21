import type { ButtonHTMLAttributes } from 'react';

export function Button({ type = 'button', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-pill px-4 py-2 font-geist font-medium text-white bg-accent hover:bg-accent-2 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
