import { render, screen } from '@testing-library/react';
import { createAppContainer } from './container';
import { ContainerProvider, useService } from './react';

function ShowBaseUrl() {
  const url = useService((c) => c.config.apiBaseUrl);
  return <span>base:{url}</span>;
}

it('resolves a service from the container via context', () => {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  render(
    <ContainerProvider container={di}>
      <ShowBaseUrl />
    </ContainerProvider>,
  );
  expect(screen.getByText('base:/api/v1')).toBeInTheDocument();
});

it('throws when useService is used without a provider', () => {
  expect(() => render(<ShowBaseUrl />)).toThrow(/ContainerProvider/);
});
