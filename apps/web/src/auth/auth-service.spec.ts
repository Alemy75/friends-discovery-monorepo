import { createTokenStore } from './token-store';
import { createAuthService } from './auth-service';
import type { AuthApi } from '../lib/api/auth-api';

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    register: vi.fn(async () => {}),
    verifyEmail: vi.fn(async () => {}),
    login: vi.fn(async () => ({ accessToken: 'acc' })),
    logout: vi.fn(async () => {}),
    me: vi.fn(async () => ({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true })),
    ...overrides,
  } as AuthApi;
}

it('login stores the access token', async () => {
  const store = createTokenStore();
  const svc = createAuthService({ authApi: fakeApi(), tokenStore: store, refreshSession: async () => true });
  await svc.login('a@b.com', 'pw');
  expect(store.get()).toBe('acc');
});

it('logout clears the token', async () => {
  const store = createTokenStore();
  store.set('acc');
  const svc = createAuthService({ authApi: fakeApi(), tokenStore: store, refreshSession: async () => true });
  await svc.logout();
  expect(store.get()).toBeNull();
});

it('currentUser returns the me payload', async () => {
  const svc = createAuthService({ authApi: fakeApi(), tokenStore: createTokenStore(), refreshSession: async () => true });
  await expect(svc.currentUser()).resolves.toMatchObject({ email: 'a@b.com' });
});
