import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-[#fb5d5d] ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
