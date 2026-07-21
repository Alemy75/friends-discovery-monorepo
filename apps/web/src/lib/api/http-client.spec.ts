import { createTokenStore } from '../../auth/token-store';
import { createHttpClient, HttpError } from './http-client';

const config = { apiBaseUrl: '/api/v1' };
afterEach(() => vi.restoreAllMocks());

it('attaches the bearer token and parses JSON', async () => {
  const store = createTokenStore();
  store.set('tok');
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  const http = createHttpClient({ config, tokenStore: store, refreshSession: async () => true });
  await expect(http.request('/auth/me')).resolves.toEqual({ ok: true });
  const headers = new Headers((fetchSpy.mock.calls[0][1] as RequestInit).headers);
  expect(headers.get('authorization')).toBe('Bearer tok');
});

it('on 401 refreshes once and retries', async () => {
  const store = createTokenStore();
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const refreshSession = vi.fn(async () => true);
  const http = createHttpClient({ config, tokenStore: store, refreshSession });
  await expect(http.request('/auth/me')).resolves.toEqual({ ok: true });
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

it('throws HttpError with status when refresh fails on 401', async () => {
  const store = createTokenStore();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  const http = createHttpClient({ config, tokenStore: store, refreshSession: async () => false });
  await expect(http.request('/auth/me')).rejects.toBeInstanceOf(HttpError);
});
