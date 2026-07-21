import { createAuthApi } from './auth-api';
import type { HttpClient } from './http-client';

function fakeHttpClient(): { httpClient: HttpClient; calls: { path: string; init?: RequestInit }[] } {
  const calls: { path: string; init?: RequestInit }[] = [];
  const httpClient: HttpClient = {
    request: vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      return undefined;
    }) as HttpClient['request'],
  };
  return { httpClient, calls };
}

it('register posts to /auth/register with the email and password', async () => {
  const { httpClient, calls } = fakeHttpClient();
  const api = createAuthApi({ httpClient });
  await api.register('a@b.com', 'pw');
  expect(calls[0].path).toBe('/auth/register');
  expect(calls[0].init?.method).toBe('POST');
  expect(JSON.parse(calls[0].init?.body as string)).toEqual({ email: 'a@b.com', password: 'pw' });
});

it('verifyEmail posts to /auth/verify-email with the email and code', async () => {
  const { httpClient, calls } = fakeHttpClient();
  const api = createAuthApi({ httpClient });
  await api.verifyEmail('a@b.com', '123456');
  expect(calls[0].path).toBe('/auth/verify-email');
  expect(calls[0].init?.method).toBe('POST');
  expect(JSON.parse(calls[0].init?.body as string)).toEqual({ email: 'a@b.com', code: '123456' });
});

it('login posts to /auth/login with the email and password', async () => {
  const { httpClient, calls } = fakeHttpClient();
  const api = createAuthApi({ httpClient });
  await api.login('a@b.com', 'pw');
  expect(calls[0].path).toBe('/auth/login');
  expect(calls[0].init?.method).toBe('POST');
  expect(JSON.parse(calls[0].init?.body as string)).toEqual({ email: 'a@b.com', password: 'pw' });
});

it('logout posts to /auth/logout with no body', async () => {
  const { httpClient, calls } = fakeHttpClient();
  const api = createAuthApi({ httpClient });
  await api.logout();
  expect(calls[0].path).toBe('/auth/logout');
  expect(calls[0].init?.method).toBe('POST');
  expect(calls[0].init?.body).toBeUndefined();
});

it('me gets /auth/me with no method override (defaults to GET)', async () => {
  const { httpClient, calls } = fakeHttpClient();
  const api = createAuthApi({ httpClient });
  await api.me();
  expect(calls[0].path).toBe('/auth/me');
  expect(calls[0].init).toBeUndefined();
});
