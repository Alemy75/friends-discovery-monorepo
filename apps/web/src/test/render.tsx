import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer, type AppContainer } from '../lib/di/container';
import { ContainerProvider } from '../lib/di/react';

export function renderWithProviders(
  ui: ReactElement,
  opts: { route?: string; container?: AppContainer } = {},
): Omit<RenderResult, 'container'> & { container: AppContainer } {
  const container = opts.container ?? createAppContainer({ apiBaseUrl: '/api/v1' });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <ContainerProvider container={container}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[opts.route ?? '/']}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ContainerProvider>,
  );
  return { ...result, container };
}
