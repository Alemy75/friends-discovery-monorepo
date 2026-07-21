import { createAppContainer } from './container';

it('builds a container exposing config', () => {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  expect(di.config.apiBaseUrl).toBe('/api/v1');
});
