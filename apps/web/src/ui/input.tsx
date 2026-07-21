import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-pill border border-hairline px-3 py-2 font-geist text-ink outline-none focus:border-accent ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
