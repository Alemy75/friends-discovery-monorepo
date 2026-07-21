import { createContext, useContext, type ReactNode } from 'react';
import type { AppContainer } from './container';

const ContainerContext = createContext<AppContainer | null>(null);

export function ContainerProvider({
  container,
  children,
}: {
  container: AppContainer;
  children: ReactNode;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): AppContainer {
  const c = useContext(ContainerContext);
  if (!c) throw new Error('useContainer must be used within a ContainerProvider');
  return c;
}

export function useService<T>(select: (c: AppContainer) => T): T {
  return select(useContainer());
}
