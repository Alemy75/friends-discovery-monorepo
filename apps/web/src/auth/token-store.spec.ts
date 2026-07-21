import { createTokenStore } from './token-store';

it('stores, returns, and clears the access token', () => {
  const store = createTokenStore();
  expect(store.get()).toBeNull();
  store.set('abc');
  expect(store.get()).toBe('abc');
  store.clear();
  expect(store.get()).toBeNull();
});
