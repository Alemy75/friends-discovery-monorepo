import type { AppConfig } from '../lib/di/container';
import type { TokenStore } from './token-store';

export function createRefreshSession({
  config,
  tokenStore,
}: {
  config: AppConfig;
  tokenStore: TokenStore;
}): () => Promise<boolean> {
  let inFlight: Promise<boolean> | null = null;

  async function doRefresh(): Promise<boolean> {
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
  }

  return () => {
    // Single-flight: concurrent callers share one in-flight refresh so we
    // never fire parallel POST /auth/refresh requests (the backend treats a
    // second use of the same refresh token as reuse/theft and kills the
    // session). Once the request settles, clear the cache so the next call
    // starts a fresh refresh.
    if (!inFlight) {
      inFlight = doRefresh().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
}
