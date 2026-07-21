import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { renderWithProviders } from '../test/render';
import { VerifyScreen } from './verify.route';

afterEach(() => vi.restoreAllMocks());

// Helper route that pushes to /verify WITH navigation state.
function Seed() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/verify', { state: { email: 'a@b.com', password: 'password123' } });
  }, [navigate]);
  return null;
}

// VerifyScreen navigates to "/" on success, so the seed route lives at a
// distinct path ("/register-seed") to avoid colliding with the post-login
// home marker registered at "/".
function tree() {
  return (
    <Routes>
      <Route path="/register-seed" element={<Seed />} />
      <Route path="/verify" element={<VerifyScreen />} />
      <Route path="/" element={<div>home</div>} />
    </Routes>
  );
}

it('verifies the code, auto-logs-in, and lands home', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/verify-email')) return new Response(null, { status: 204 });
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    return new Response(null, { status: 404 });
  });
  renderWithProviders(tree(), { route: '/register-seed' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument());
  await userEvent.type(screen.getByLabelText('Код из письма'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
  await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
});

it('shows a recovery message and a link to /login when verify succeeds but auto-login fails', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/verify-email')) return new Response(null, { status: 204 });
    if (url.endsWith('/auth/login')) return new Response(null, { status: 500 });
    return new Response(null, { status: 404 });
  });
  renderWithProviders(tree(), { route: '/register-seed' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument());
  await userEvent.type(screen.getByLabelText('Код из письма'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

  // The user must not see the misleading "invalid code" message, must not be
  // stuck resubmitting the (now-consumed) code, and must have an in-app path
  // forward to /login.
  await waitFor(() => expect(screen.getByText('Email подтверждён')).toBeInTheDocument());
  expect(screen.queryByText('Неверный или просроченный код')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Подтвердить' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Перейти на страницу входа' })).toHaveAttribute('href', '/login');
});

it('redirects to /register when there is no email in navigation state', async () => {
  renderWithProviders(
    <Routes>
      <Route path="/verify" element={<VerifyScreen />} />
      <Route path="/register" element={<div>register-screen</div>} />
    </Routes>,
    { route: '/verify' },
  );
  await waitFor(() => expect(screen.getByText('register-screen')).toBeInTheDocument());
});
