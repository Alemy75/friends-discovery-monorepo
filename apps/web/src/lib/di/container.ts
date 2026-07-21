import { dikon } from './dikon';

export interface AppConfig {
  readonly apiBaseUrl: string;
}

export function createAppContainer(config: AppConfig) {
  return dikon()
    .provide({ config: () => config })
    .build();
}

export type AppContainer = ReturnType<typeof createAppContainer>;
