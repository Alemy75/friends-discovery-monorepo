import type { ReactNode } from 'react';
import { Card } from '../ui/card';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-geist font-medium text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 font-geist text-mid-gray">{subtitle}</p> : null}
        </div>
        <Card>{children}</Card>
        {footer ? <p className="mt-5 text-center text-sm font-geist text-mid-gray">{footer}</p> : null}
      </div>
    </div>
  );
}
