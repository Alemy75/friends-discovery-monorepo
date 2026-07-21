import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { RegisterScreen } from './register.route';
import { VerifyScreen } from './verify.route';

afterEach(() => vi.restoreAllMocks());

it('register → verify → auto-login → home', async () => {
  let loggedIn = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/register')) return new Response(null, { status: 201 });
    if (url.endsWith('/auth/verify-email')) return new Response(null, { status: 204 });
    if (url.endsWith('/auth/login')) {
      loggedIn = true;
      return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    }
    if (url.endsWith('/auth/me')) {
      return loggedIn
        ? new Response(
            JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
            { status: 200 },
          )
        : new Response(null, { status: 401 });
    }
    return new Response(null, { status: 404 });
  });

  renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/verify" element={<VerifyScreen />} />
      <Route path="/" element={<div>home-landing</div>} />
    </Routes>,
    { route: '/register' },
  );

  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument());
  await userEvent.type(screen.getByLabelText('Код из письма'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

  await waitFor(() => expect(screen.getByText('home-landing')).toBeInTheDocument());
});
