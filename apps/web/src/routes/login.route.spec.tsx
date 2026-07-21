import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { LoginScreen } from './login.route';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={<div>home</div>} />
    </Routes>
  );
}

it('logs in and lands home', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    return new Response(null, { status: 404 });
  });
  renderWithProviders(tree(), { route: '/login' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
});

it('shows a 401 error on bad credentials', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).endsWith('/auth/login') ? new Response(null, { status: 401 }) : new Response(null, { status: 404 }),
  );
  renderWithProviders(tree(), { route: '/login' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'nope1234');
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await waitFor(() => expect(screen.getByText('Неверный email или пароль')).toBeInTheDocument());
});
