import { createAppContainer } from './container';

afterEach(() => vi.restoreAllMocks());

it('wires services so a 401 triggers a refresh then a successful retry', async () => {
  vi.spyOn(globalThis, 'fetch')
    // first authService.currentUser() → 401
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    // refreshSession() → 200 with a new token
    .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'fresh' }), { status: 200 }))
    // retried /auth/me → 200
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }),
        { status: 200 },
      ),
    );

  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  await expect(di.authService.currentUser()).resolves.toMatchObject({ email: 'a@b.com' });
  expect(di.tokenStore.get()).toBe('fresh');
});
