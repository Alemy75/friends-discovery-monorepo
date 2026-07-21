import { dikon } from './dikon';
import { createTokenStore } from '../../auth/token-store';
import { createRefreshSession } from '../../auth/refresh-session';
import { createHttpClient } from '../api/http-client';
import { createAuthApi } from '../api/auth-api';
import { createAuthService } from '../../auth/auth-service';

export interface AppConfig {
  readonly apiBaseUrl: string;
}

export function createAppContainer(config: AppConfig) {
  return dikon()
    .provide({ config: () => config })
    .provide({ tokenStore: () => createTokenStore() })
    .provide({ refreshSession: ({ config, tokenStore }) => createRefreshSession({ config, tokenStore }) })
    .provide({
      httpClient: ({ config, tokenStore, refreshSession }) =>
        createHttpClient({ config, tokenStore, refreshSession }),
    })
    .provide({ authApi: ({ httpClient }) => createAuthApi({ httpClient }) })
    .provide({
      authService: ({ authApi, tokenStore, refreshSession }) =>
        createAuthService({ authApi, tokenStore, refreshSession }),
    })
    .build();
}

export type AppContainer = ReturnType<typeof createAppContainer>;
