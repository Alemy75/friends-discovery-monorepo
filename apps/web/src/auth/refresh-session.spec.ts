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

it('posts to /auth/refresh with credentials included', async () => {
  const store = createTokenStore();
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
  );
  const refresh = createRefreshSession({ config, tokenStore: store });
  await refresh();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  expect(String(url).endsWith('/auth/refresh')).toBe(true);
  expect(init.method).toBe('POST');
  expect(init.credentials).toBe('include');
});

it('single-flights concurrent calls into one network request', async () => {
  const store = createTokenStore();
  let resolveFetch!: (res: Response) => void;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
  );
  const refresh = createRefreshSession({ config, tokenStore: store });

  const first = refresh();
  const second = refresh();

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  resolveFetch(new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }));

  const [firstResult, secondResult] = await Promise.all([first, second]);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(firstResult).toBe(true);
  expect(secondResult).toBe(true);
});

it('starts a fresh refresh after the previous one has settled', async () => {
  const store = createTokenStore();
  // A fresh Response per call: Response bodies can only be consumed once, so
  // reusing one instance across two `res.json()` reads would fail the second.
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }));
  const refresh = createRefreshSession({ config, tokenStore: store });

  await expect(refresh()).resolves.toBe(true);
  await expect(refresh()).resolves.toBe(true);

  expect(fetchSpy).toHaveBeenCalledTimes(2);
});
