import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { RequireAuth } from './require-auth';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAuth>
            <div>secret</div>
          </RequireAuth>
        }
      />
      <Route path="/login" element={<div>login-screen</div>} />
    </Routes>
  );
}

it('redirects to /login when unauthenticated', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByText('login-screen')).toBeInTheDocument());
});

it('renders children when authenticated', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
      { status: 200 },
    ),
  );
  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument());
});

it('shows a loading state while the auth check is pending', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  renderWithProviders(tree(), { route: '/' });
  expect(await screen.findByText('Загрузка…')).toBeInTheDocument();
  expect(screen.queryByText('secret')).not.toBeInTheDocument();
  expect(screen.queryByText('login-screen')).not.toBeInTheDocument();
});
