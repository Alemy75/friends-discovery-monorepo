import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { HomeRoute } from './home.route';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<div>login-screen</div>} />
    </Routes>
  );
}

it("shows the signed-in user's email", async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
      { status: 200 },
    ),
  );
  renderWithProviders(<HomeRoute />);
  await waitFor(() => expect(screen.getByText('Вы вошли как a@b.com')).toBeInTheDocument());
});

it('logs out and returns to /login', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) {
      return new Response(
        JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
        { status: 200 },
      );
    }
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  });

  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByText('Вы вошли как a@b.com')).toBeInTheDocument());
  await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
  await waitFor(() => expect(screen.getByText('login-screen')).toBeInTheDocument());
});

it('shows an error and stays put (without clearing the session) when logout fails', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) {
      return new Response(
        JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
        { status: 200 },
      );
    }
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 500 });
    return new Response(null, { status: 404 });
  });

  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByText('Вы вошли как a@b.com')).toBeInTheDocument());
  const button = screen.getByRole('button', { name: 'Выйти' });
  await userEvent.click(button);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/не удалось выйти/i);
  expect(screen.queryByText('login-screen')).not.toBeInTheDocument();
  await waitFor(() => expect(button).not.toBeDisabled());
});
