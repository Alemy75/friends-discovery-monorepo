import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the app placeholder', () => {
  render(<App />);
  expect(screen.getByText('friends.ai')).toBeInTheDocument();
});
