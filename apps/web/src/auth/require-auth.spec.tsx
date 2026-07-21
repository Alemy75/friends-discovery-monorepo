import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer } from '../lib/di/container';
import { ContainerProvider } from '../lib/di/react';
import { RequireAuth } from './require-auth';

function renderRequireAuth(fetchImpl: (input: RequestInfo | URL) => Promise<Response>) {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchImpl);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ContainerProvider container={di}>
      <QueryClientProvider client={qc}>
        <RequireAuth>
          <p>Защищённый контент</p>
        </RequireAuth>
      </QueryClientProvider>
    </ContainerProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

it('shows a loading state while the session is being resolved', () => {
  renderRequireAuth(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/refresh')) return new Response(null, { status: 401 });
    return new Response(null, { status: 401 });
  });
  expect(screen.getByText('Загрузка…')).toBeInTheDocument();
});

it('shows the unauthenticated message once /auth/me resolves as 401', async () => {
  renderRequireAuth(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/refresh')) return new Response(null, { status: 401 });
    if (url.endsWith('/auth/me')) return new Response(null, { status: 401 });
    return new Response(null, { status: 404 });
  });
  await waitFor(() => expect(screen.getByText('Вы не вошли в систему.')).toBeInTheDocument());
});

it('renders children once authenticated', async () => {
  renderRequireAuth(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/refresh')) return new Response(null, { status: 401 });
    if (url.endsWith('/auth/me')) {
      return new Response(
        JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
        { status: 200 },
      );
    }
    return new Response(null, { status: 404 });
  });
  await waitFor(() => expect(screen.getByText('Защищённый контент')).toBeInTheDocument());
});
