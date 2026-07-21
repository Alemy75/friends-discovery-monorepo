import { render, screen } from '@testing-library/react';
import { Button } from './button';

it('renders a button with its label and type', () => {
  render(<Button>Продолжить</Button>);
  const btn = screen.getByRole('button', { name: 'Продолжить' });
  expect(btn).toHaveAttribute('type', 'button');
});
