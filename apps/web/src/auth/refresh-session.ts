import type { AppConfig } from '../lib/di/container';
import type { TokenStore } from './token-store';

export function createRefreshSession({
  config,
  tokenStore,
}: {
  config: AppConfig;
  tokenStore: TokenStore;
}): () => Promise<boolean> {
  return async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        tokenStore.clear();
        return false;
      }
      const body = (await res.json()) as { accessToken: string };
      tokenStore.set(body.accessToken);
      return true;
    } catch {
      tokenStore.clear();
      return false;
    }
  };
}
