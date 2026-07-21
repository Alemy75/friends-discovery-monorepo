import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { RegisterScreen } from './register.route';
import { PrivacyPolicyPage, TermsPage } from './legal.route';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/verify" element={<div>verify-step</div>} />
    </Routes>
  );
}

it('registers and advances to the verify step', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  await waitFor(() => expect(screen.getByText('verify-step')).toBeInTheDocument());
});

it('shows a 409 error message when the email is taken', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 409 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  await waitFor(() => expect(screen.getByText('Этот email уже зарегистрирован')).toBeInTheDocument());
});

it('announces the submission error to assistive tech and moves focus to it', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 409 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Этот email уже зарегистрирован');
  await waitFor(() => expect(alert).toHaveFocus());
});

it('shows a 400 error message when the submission is invalid', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 400 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  await waitFor(() => expect(screen.getByText('Проверьте email и пароль')).toBeInTheDocument());
});

it('blocks submission without consent and shows the required-consent error', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  await waitFor(() =>
    expect(screen.getByText('Необходимо согласие на обработку персональных данных')).toBeInTheDocument(),
  );
  expect(screen.queryByText('verify-step')).not.toBeInTheDocument();
  expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith('/auth/register'))).toBe(false);
});

it('renders the placeholder privacy policy page', () => {
  renderWithProviders(
    <Routes>
      <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
    </Routes>,
    { route: '/legal/privacy' },
  );
  expect(screen.getByRole('heading', { name: 'Политика обработки персональных данных' })).toBeInTheDocument();
  expect(screen.getByText('Черновик — финальный текст готовится.')).toBeInTheDocument();
});

it('renders the placeholder terms of service page', () => {
  renderWithProviders(
    <Routes>
      <Route path="/legal/terms" element={<TermsPage />} />
    </Routes>,
    { route: '/legal/terms' },
  );
  expect(screen.getByRole('heading', { name: 'Пользовательское соглашение' })).toBeInTheDocument();
  expect(screen.getByText('Черновик — финальный текст готовится.')).toBeInTheDocument();
});
