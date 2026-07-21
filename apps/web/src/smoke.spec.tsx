import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

it('renders the shell and resolves to "not signed in" against a 401 backend', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  render(<App />);
  await waitFor(() => expect(screen.getByText('Вы не вошли в систему.')).toBeInTheDocument());
});
