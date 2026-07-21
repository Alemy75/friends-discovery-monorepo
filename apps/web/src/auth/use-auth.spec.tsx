import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer } from '../lib/di/container';
import { ContainerProvider } from '../lib/di/react';
import { useAuth } from './use-auth';

function Harness() {
  const { user, isAuthenticated, login } = useAuth();
  return (
    <div>
      <span>auth:{String(isAuthenticated)}</span>
      <span>email:{user?.email ?? '-'}</span>
      <button onClick={() => login('a@b.com', 'pw')}>login</button>
    </div>
  );
}

function renderWithFakeApi() {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  // Fake the network: /auth/me 401 until login, then a user.
  let loggedIn = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/login')) {
      loggedIn = true;
      return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    }
    if (url.endsWith('/auth/refresh')) return new Response(null, { status: 401 });
    if (url.endsWith('/auth/me')) {
      return loggedIn
        ? new Response(JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }), { status: 200 })
        : new Response(null, { status: 401 });
    }
    return new Response(null, { status: 404 });
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ContainerProvider container={di}>
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>
    </ContainerProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

it('reflects unauthenticated then authenticated after login', async () => {
  renderWithFakeApi();
  await waitFor(() => expect(screen.getByText('auth:false')).toBeInTheDocument());
  await userEvent.click(screen.getByText('login'));
  await waitFor(() => expect(screen.getByText('email:a@b.com')).toBeInTheDocument());
});

it('register() calls the backend register endpoint', async () => {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  const calls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    calls.push(String(input));
    return new Response(null, { status: 201 });
  });
  function H() {
    const { register } = useAuth();
    return <button onClick={() => register('a@b.com', 'password123')}>go</button>;
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ContainerProvider container={di}>
      <QueryClientProvider client={qc}>
        <H />
      </QueryClientProvider>
    </ContainerProvider>,
  );
  await userEvent.click(screen.getByText('go'));
  await waitFor(() => expect(calls.some((u) => u.endsWith('/auth/register'))).toBe(true));
});
