import { render, screen } from '@testing-library/react';
import { Input } from './input';

it('renders an input and forwards its value and placeholder', () => {
  render(<Input placeholder="Email" defaultValue="a@b.com" />);
  const input = screen.getByPlaceholderText('Email');
  expect(input).toBeInTheDocument();
  expect(input).toHaveValue('a@b.com');
});
