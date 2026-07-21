import { render, screen } from '@testing-library/react';
import { Card } from './card';

it('renders its children inside the card container', () => {
  render(<Card>Привет, карточка</Card>);
  expect(screen.getByText('Привет, карточка')).toBeInTheDocument();
});
