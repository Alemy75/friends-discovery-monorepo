import type { AuthTokens, MeResponse } from '@friends-ai/contracts';
import type { HttpClient } from './http-client';

export interface AuthApi {
  register(email: string, password: string): Promise<void>;
  verifyEmail(email: string, code: string): Promise<void>;
  login(email: string, password: string): Promise<AuthTokens>;
  logout(): Promise<void>;
  me(): Promise<MeResponse>;
}

export function createAuthApi({ httpClient }: { httpClient: HttpClient }): AuthApi {
  return {
    register: (email, password) =>
      httpClient.request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    verifyEmail: (email, code) =>
      httpClient.request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, code }) }),
    login: (email, password) =>
      httpClient.request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => httpClient.request('/auth/logout', { method: 'POST' }),
    me: () => httpClient.request<MeResponse>('/auth/me'),
  };
}
