import type { ReactNode } from 'react';
import { useAuth } from './use-auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <p>Загрузка…</p>;
  if (!isAuthenticated) return <p>Вы не вошли в систему.</p>;
  return <>{children}</>;
}
