import type { AppConfig } from '../di/container';
import type { TokenStore } from '../../auth/token-store';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export interface HttpClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export function createHttpClient({
  config,
  tokenStore,
  refreshSession,
}: {
  config: AppConfig;
  tokenStore: TokenStore;
  refreshSession: () => Promise<boolean>;
}): HttpClient {
  async function send(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    const token = tokenStore.get();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${config.apiBaseUrl}${path}`, { ...init, headers, credentials: 'include' });
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => undefined);
    if (!res.ok) throw new HttpError(res.status, body);
    return body as T;
  }

  return {
    async request<T>(path: string, init?: RequestInit): Promise<T> {
      let res = await send(path, init);
      if (res.status === 401 && (await refreshSession())) {
        res = await send(path, init);
      }
      return parse<T>(res);
    },
  };
}
