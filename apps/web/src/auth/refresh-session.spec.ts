import { createTokenStore } from './token-store';
import { createRefreshSession } from './refresh-session';

const config = { apiBaseUrl: '/api/v1' };

afterEach(() => vi.restoreAllMocks());

it('stores the new access token and returns true on 200', async () => {
  const store = createTokenStore();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
  );
  const refresh = createRefreshSession({ config, tokenStore: store });
  await expect(refresh()).resolves.toBe(true);
  expect(store.get()).toBe('new');
});

it('clears the token and returns false on 401', async () => {
  const store = createTokenStore();
  store.set('old');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  const refresh = createRefreshSession({ config, tokenStore: store });
  await expect(refresh()).resolves.toBe(false);
  expect(store.get()).toBeNull();
});
