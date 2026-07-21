import type { ButtonHTMLAttributes } from 'react';

export function Button({ type = 'button', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-white bg-[#fb5d5d] hover:bg-[#ff8e72] disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
