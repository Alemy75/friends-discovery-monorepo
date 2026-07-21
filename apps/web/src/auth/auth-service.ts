import type { MeResponse } from '@friends-ai/contracts';
import type { AuthApi } from '../lib/api/auth-api';
import type { TokenStore } from './token-store';

export interface AuthService {
  register(email: string, password: string): Promise<void>;
  verifyEmail(email: string, code: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<boolean>;
  currentUser(): Promise<MeResponse>;
}

export function createAuthService({
  authApi,
  tokenStore,
  refreshSession,
}: {
  authApi: AuthApi;
  tokenStore: TokenStore;
  refreshSession: () => Promise<boolean>;
}): AuthService {
  return {
    register: (email, password) => authApi.register(email, password),
    verifyEmail: (email, code) => authApi.verifyEmail(email, code),
    async login(email, password) {
      const { accessToken } = await authApi.login(email, password);
      tokenStore.set(accessToken);
    },
    async logout() {
      await authApi.logout();
      tokenStore.clear();
    },
    refresh: refreshSession,
    currentUser: () => authApi.me(),
  };
}
