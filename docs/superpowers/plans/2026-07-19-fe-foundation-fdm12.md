# Frontend Foundation (FDM-12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production SPA `apps/web` (React + Vite + TS) with a **dikon DI container** holding all business logic (http client, auth), provided across the app via React context, plus TanStack Query, the ported design system, and CI — no real screens yet (those are FDM-13).

**Architecture:** Business logic lives in **framework-agnostic service factories** wired by a [dikon](https://github.com/temoncher/dikon) container (`dikon().provide({...}).build({config})`). React never imports dikon directly: a thin `ContainerProvider` puts the built container on context and `useService(selector)` resolves services. TanStack Query is the React server-cache layer that *calls* the injected services. The refresh cookie is httpOnly (browser-managed); the access token lives in memory in `tokenStore`; a dedicated `refreshSession` service does a bare `POST /auth/refresh` so the http client's 401→refresh→retry interceptor doesn't recurse. Dev uses a Vite proxy (`/api` → `:3000`) so the SPA and API are same-origin and the refresh cookie flows.

**Tech Stack:** React 18, Vite 5, TypeScript 5 (strict), react-router-dom 6, @tanstack/react-query 5, react-hook-form 7 + zod + @hookform/resolvers, Tailwind CSS v4 (@tailwindcss/vite), @heroicons/react, dikon (vendored), Vitest + @testing-library/react + jsdom, `@friends-ai/contracts`.

## Global Constraints

- Node ≥ 20; TypeScript `strict: true` (extend repo `tsconfig.base.json`). npm workspaces; commit `package-lock.json`.
- **React never imports `dikon` or a concrete service module directly** — components/hooks get business logic only through `useService(...)`. Services are plain factories `(deps) => api` with no React imports.
- **DI service graph is acyclic:** `config → tokenStore → refreshSession → httpClient → authApi → authService`. The http client's 401 handler calls `refreshSession` (bare fetch), never `authService`/`authApi`.
- Access token in memory only (`tokenStore`); refresh token is the backend's httpOnly cookie — never read/write it from JS. All API calls use `credentials: 'include'`.
- API base path is `/api/v1`; in dev the Vite proxy forwards `/api` → `http://localhost:3000` with `changeOrigin` + `cookieDomainRewrite: ''` so the refresh cookie is attributed to the SPA origin.
- Shared response/enum types come from `@friends-ai/contracts` (`Role`, `AccountStatus`, `MeResponse`, `AuthTokens`). DTO request shapes are defined locally with zod.
- Vendored `dikon.ts` carries an attribution header (source URL + author); it is used verbatim otherwise.
- **No real auth screens in this plan** — only the shell + a connection proof. Screens are FDM-13.
- Every task ends on green tests + a commit. TDD: failing test first. Tests: Vitest + Testing Library, jsdom env.

## File Structure

```
apps/web/
  package.json · tsconfig.json · vite.config.ts · index.html
  vitest.config.ts · src/test/setup.ts
  src/
    main.tsx                      # createRoot → <App/>
    App.tsx                       # ContainerProvider → QueryClientProvider → RouterProvider
    index.css                     # Tailwind + @theme tokens (ported from reference)
    lib/
      di/
        dikon.ts                  # vendored library (temoncher/dikon)
        container.ts              # createAppContainer(config) → built dikon container; AppContainer type
        react.tsx                 # ContainerContext, ContainerProvider, useContainer, useService
      api/
        http-client.ts            # createHttpClient({config, tokenStore, refreshSession})
        auth-api.ts               # createAuthApi({httpClient})
    auth/
      token-store.ts              # createTokenStore()
      refresh-session.ts          # createRefreshSession({config, tokenStore})
      auth-service.ts             # createAuthService({authApi, tokenStore, refreshSession})
      use-auth.ts                 # TanStack Query hooks over injected authService
      require-auth.tsx            # route guard
    ui/
      button.tsx · input.tsx · card.tsx   # ported primitives
    routes/
      router.tsx                  # react-router config
      app-shell.tsx               # layout
      home.route.tsx              # placeholder + connection proof (shows /me or "not signed in")
```

---

## Task 1: Scaffold `apps/web` (Vite + React + TS + Tailwind + Vitest) and CI

**Files:** Create `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,vitest.config.ts}`, `apps/web/src/{main.tsx,App.tsx,index.css}`, `apps/web/src/test/setup.ts`, `apps/web/src/smoke.spec.tsx`; Modify `.github/workflows/ci.yml`, `.claude/launch.json`.

**Interfaces:**
- Produces: a buildable/dev-runnable `@friends-ai/web` workspace; `App` component rendering a placeholder; Vitest configured (jsdom + RTL). No DI yet.

- [ ] **Step 1: package.json**

Create `apps/web/package.json`:

```json
{
  "name": "@friends-ai/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@friends-ai/contracts": "*",
    "@heroicons/react": "^2.1.5",
    "@hookform/resolvers": "^3.9.0",
    "@tanstack/react-query": "^5.59.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "react-router-dom": "^6.27.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: tsconfig + vite config + html**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true
  },
  "include": ["src"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        cookieDomainRewrite: '',
      },
    },
  },
});
```

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>friends.ai</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write the failing smoke test**

Create `apps/web/src/smoke.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the app placeholder', () => {
  render(<App />);
  expect(screen.getByText('friends.ai')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run → fail**

Run: `npm install && npm test -w @friends-ai/web`
Expected: FAIL — cannot find `./App`.

- [ ] **Step 5: Minimal App + main + css**

Create `apps/web/src/App.tsx`:

```tsx
export function App() {
  return <h1>friends.ai</h1>;
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `apps/web/src/index.css`:

```css
@import 'tailwindcss';
```

- [ ] **Step 6: Run → pass**

Run: `npm test -w @friends-ai/web && npm run build -w @friends-ai/web`
Expected: smoke test PASS; build succeeds.

- [ ] **Step 7: CI + launch.json**

In `.github/workflows/ci.yml`, the existing `npm run lint/typecheck/test --workspaces --if-present` steps already pick up `@friends-ai/web`. Add one line after the api build step: `- run: npm run build -w @friends-ai/web`.

Replace `.claude/launch.json` configuration with the web app:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "web", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "-w", "@friends-ai/web"], "port": 5173 }
  ]
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/web .github/workflows/ci.yml .claude/launch.json package-lock.json
git commit -m "feat(web): scaffold apps/web (Vite+React+TS+Tailwind+Vitest) + CI"
```

---

## Task 2: Vendor dikon + app container skeleton

**Files:** Create `apps/web/src/lib/di/dikon.ts` (vendored), `apps/web/src/lib/di/container.ts`, `apps/web/src/lib/di/container.spec.ts`.

**Interfaces:**
- Produces: `createAppContainer(config: AppConfig)` returning a built dikon container; `type AppConfig = { apiBaseUrl: string }`; `type AppContainer = ReturnType<typeof createAppContainer>`. At this task the container provides only `config`.

- [ ] **Step 1: Vendor dikon.ts**

Run (from repo root):

```bash
mkdir -p apps/web/src/lib/di
{ printf '// Vendored from https://github.com/temoncher/dikon (temoncher) — copy-in DI library, no npm package.\n// Kept verbatim; do not edit.\n'; curl -fsSL https://raw.githubusercontent.com/temoncher/dikon/main/dikon.ts; } > apps/web/src/lib/di/dikon.ts
head -5 apps/web/src/lib/di/dikon.ts
```

Expected: file written; header + `export function dikon(` visible.

- [ ] **Step 2: Failing test**

Create `apps/web/src/lib/di/container.spec.ts`:

```ts
import { createAppContainer } from './container';

it('builds a container exposing config', () => {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  expect(di.config.apiBaseUrl).toBe('/api/v1');
});
```

- [ ] **Step 3: Run → fail**

Run: `npm test -w @friends-ai/web -- container`
Expected: FAIL — cannot find `./container`.

- [ ] **Step 4: Implement container skeleton**

Create `apps/web/src/lib/di/container.ts`:

```ts
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
```

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- container`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/di
git commit -m "feat(web): vendor dikon + app container skeleton"
```

---

## Task 3: React DI glue (ContainerProvider + useService)

**Files:** Create `apps/web/src/lib/di/react.tsx`, `apps/web/src/lib/di/react.spec.tsx`.

**Interfaces:**
- Consumes: `AppContainer` (Task 2).
- Produces:
  - `<ContainerProvider container={AppContainer}>{children}</ContainerProvider>`
  - `useContainer(): AppContainer` (throws if used outside the provider)
  - `useService<T>(select: (c: AppContainer) => T): T`

- [ ] **Step 1: Failing test**

Create `apps/web/src/lib/di/react.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createAppContainer } from './container';
import { ContainerProvider, useService } from './react';

function ShowBaseUrl() {
  const url = useService((c) => c.config.apiBaseUrl);
  return <span>base:{url}</span>;
}

it('resolves a service from the container via context', () => {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  render(
    <ContainerProvider container={di}>
      <ShowBaseUrl />
    </ContainerProvider>,
  );
  expect(screen.getByText('base:/api/v1')).toBeInTheDocument();
});

it('throws when useService is used without a provider', () => {
  expect(() => render(<ShowBaseUrl />)).toThrow(/ContainerProvider/);
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- react`
Expected: FAIL — cannot find `./react`.

- [ ] **Step 3: Implement the glue**

Create `apps/web/src/lib/di/react.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { AppContainer } from './container';

const ContainerContext = createContext<AppContainer | null>(null);

export function ContainerProvider({
  container,
  children,
}: {
  container: AppContainer;
  children: ReactNode;
}) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

export function useContainer(): AppContainer {
  const c = useContext(ContainerContext);
  if (!c) throw new Error('useContainer must be used within a ContainerProvider');
  return c;
}

export function useService<T>(select: (c: AppContainer) => T): T {
  return select(useContainer());
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -w @friends-ai/web -- react`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/di/react.tsx apps/web/src/lib/di/react.spec.tsx
git commit -m "feat(web): React DI glue (ContainerProvider + useService)"
```

---

## Task 4: tokenStore service

**Files:** Create `apps/web/src/auth/token-store.ts`, `apps/web/src/auth/token-store.spec.ts`.

**Interfaces:**
- Produces: `createTokenStore(): TokenStore` where `interface TokenStore { get(): string | null; set(token: string): void; clear(): void }`. In-memory only.

- [ ] **Step 1: Failing test**

Create `apps/web/src/auth/token-store.spec.ts`:

```ts
import { createTokenStore } from './token-store';

it('stores, returns, and clears the access token', () => {
  const store = createTokenStore();
  expect(store.get()).toBeNull();
  store.set('abc');
  expect(store.get()).toBe('abc');
  store.clear();
  expect(store.get()).toBeNull();
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- token-store`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/auth/token-store.ts`:

```ts
export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}

export function createTokenStore(): TokenStore {
  let token: string | null = null;
  return {
    get: () => token,
    set: (t) => {
      token = t;
    },
    clear: () => {
      token = null;
    },
  };
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -w @friends-ai/web -- token-store`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/token-store.ts apps/web/src/auth/token-store.spec.ts
git commit -m "feat(web): in-memory tokenStore service"
```

---

## Task 5: refreshSession service (bare refresh — breaks the DI cycle)

**Files:** Create `apps/web/src/auth/refresh-session.ts`, `apps/web/src/auth/refresh-session.spec.ts`.

**Interfaces:**
- Consumes: `AppConfig` (`config`), `TokenStore`.
- Produces: `createRefreshSession({ config, tokenStore }): () => Promise<boolean>` — does a bare `POST {apiBaseUrl}/auth/refresh` with `credentials:'include'`; on 200 stores `accessToken` from the body and returns `true`; on any non-200/error clears the token and returns `false`. Uses global `fetch` (not the http client), so it never recurses through the 401 interceptor.

- [ ] **Step 1: Failing test**

Create `apps/web/src/auth/refresh-session.spec.ts`:

```ts
import { createTokenStore } from './token-store';
import { createRefreshSession } from './refresh-session';

const config = { apiBaseUrl: '/api/v1' };

afterEach(() => vi.restoreAllMocks());

it('stores the new access token and returns true on 200', async () => {
  const store = createTokenStore();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ accessToken: 'new' }), { status: 200 }),
  );
  const refresh = createRefreshSession({ config, tokenStore: store });
  await expect(refresh()).resolves.toBe(true);
  expect(store.get()).toBe('new');
});

it('clears the token and returns false on 401', async () => {
  const store = createTokenStore();
  store.set('old');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  const refresh = createRefreshSession({ config, tokenStore: store });
  await expect(refresh()).resolves.toBe(false);
  expect(store.get()).toBeNull();
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- refresh-session`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/auth/refresh-session.ts`:

```ts
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
```

- [ ] **Step 4: Run → pass**

Run: `npm test -w @friends-ai/web -- refresh-session`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/refresh-session.ts apps/web/src/auth/refresh-session.spec.ts
git commit -m "feat(web): refreshSession service (bare refresh, cycle-free)"
```

---

## Task 6: httpClient service (401 → refresh → retry once)

**Files:** Create `apps/web/src/lib/api/http-client.ts`, `apps/web/src/lib/api/http-client.spec.ts`.

**Interfaces:**
- Consumes: `AppConfig`, `TokenStore`, `refreshSession: () => Promise<boolean>`.
- Produces: `createHttpClient({ config, tokenStore, refreshSession }): HttpClient` where `interface HttpClient { request<T>(path: string, init?: RequestInit): Promise<T> }`. Behavior: prefixes `apiBaseUrl`; `credentials:'include'`; sets `Authorization: Bearer <token>` when present + `Content-Type: application/json`; parses JSON (204 → `undefined`); on non-2xx throws `HttpError { status, body }`; on 401 calls `refreshSession()` once — if true, retries the request once, else throws.

- [ ] **Step 1: Failing test**

Create `apps/web/src/lib/api/http-client.spec.ts`:

```ts
import { createTokenStore } from '../../auth/token-store';
import { createHttpClient, HttpError } from './http-client';

const config = { apiBaseUrl: '/api/v1' };
afterEach(() => vi.restoreAllMocks());

it('attaches the bearer token and parses JSON', async () => {
  const store = createTokenStore();
  store.set('tok');
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  const http = createHttpClient({ config, tokenStore: store, refreshSession: async () => true });
  await expect(http.request('/auth/me')).resolves.toEqual({ ok: true });
  const headers = new Headers((fetchSpy.mock.calls[0][1] as RequestInit).headers);
  expect(headers.get('authorization')).toBe('Bearer tok');
});

it('on 401 refreshes once and retries', async () => {
  const store = createTokenStore();
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const refreshSession = vi.fn(async () => true);
  const http = createHttpClient({ config, tokenStore: store, refreshSession });
  await expect(http.request('/auth/me')).resolves.toEqual({ ok: true });
  expect(refreshSession).toHaveBeenCalledTimes(1);
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

it('throws HttpError with status when refresh fails on 401', async () => {
  const store = createTokenStore();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  const http = createHttpClient({ config, tokenStore: store, refreshSession: async () => false });
  await expect(http.request('/auth/me')).rejects.toBeInstanceOf(HttpError);
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- http-client`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/api/http-client.ts`:

```ts
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
```

- [ ] **Step 4: Run → pass**

Run: `npm test -w @friends-ai/web -- http-client`
Expected: PASS (all three).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/http-client.ts apps/web/src/lib/api/http-client.spec.ts
git commit -m "feat(web): httpClient with 401→refresh→retry"
```

---

## Task 7: authApi + authService

**Files:** Create `apps/web/src/lib/api/auth-api.ts`, `apps/web/src/auth/auth-service.ts`, `apps/web/src/auth/auth-service.spec.ts`.

**Interfaces:**
- Consumes: `HttpClient`, `TokenStore`, `refreshSession`, contracts `MeResponse`/`AuthTokens`.
- Produces:
  - `createAuthApi({ httpClient }): AuthApi` with `register(email,password)`, `verifyEmail(email,code)`, `login(email,password): Promise<AuthTokens>`, `logout()`, `me(): Promise<MeResponse>` (all via `httpClient.request`).
  - `createAuthService({ authApi, tokenStore, refreshSession }): AuthService` with `login(email,password): Promise<void>` (stores `accessToken`), `logout(): Promise<void>` (clears token), `refresh(): Promise<boolean>` (= refreshSession), `currentUser(): Promise<MeResponse>`, `register`, `verifyEmail` (pass-through).

- [ ] **Step 1: Failing test**

Create `apps/web/src/auth/auth-service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- auth-service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement authApi**

Create `apps/web/src/lib/api/auth-api.ts`:

```ts
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
```

- [ ] **Step 4: Implement authService**

Create `apps/web/src/auth/auth-service.ts`:

```ts
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
```

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- auth-service`
Expected: PASS (all three).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/auth-api.ts apps/web/src/auth/auth-service.ts apps/web/src/auth/auth-service.spec.ts
git commit -m "feat(web): authApi + authService"
```

---

## Task 8: Wire the full container + integration test

**Files:** Modify `apps/web/src/lib/di/container.ts`; Create `apps/web/src/lib/di/container.integration.spec.ts`.

**Interfaces:**
- Produces: `createAppContainer(config)` now exposes `config`, `tokenStore`, `refreshSession`, `httpClient`, `authApi`, `authService` (all typed). Graph: `config → tokenStore → refreshSession → httpClient → authApi → authService`.

- [ ] **Step 1: Failing integration test**

Create `apps/web/src/lib/di/container.integration.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- container.integration`
Expected: FAIL — `di.authService` undefined.

- [ ] **Step 3: Wire the container**

Replace `apps/web/src/lib/di/container.ts` with:

```ts
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
```

- [ ] **Step 4: Run → pass**

Run: `npm test -w @friends-ai/web -- container` (runs the skeleton + integration specs)
Expected: PASS — the 401→refresh→retry flows through the real wired services.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/di/container.ts apps/web/src/lib/di/container.integration.spec.ts
git commit -m "feat(web): wire full DI container + integration test"
```

---

## Task 9: useAuth (TanStack Query over injected authService) + RequireAuth

**Files:** Create `apps/web/src/auth/use-auth.ts`, `apps/web/src/auth/require-auth.tsx`, `apps/web/src/auth/use-auth.spec.tsx`.

**Interfaces:**
- Consumes: `useService` (Task 3), `AuthService`, TanStack Query.
- Produces:
  - `useAuth()` → `{ user: MeResponse | undefined, isLoading: boolean, isAuthenticated: boolean, login(email,password), logout() }`. Uses a `['me']` query calling `authService.currentUser()` (retry: false), and mutations for login/logout that invalidate `['me']`.
  - `<RequireAuth>` — renders children when authenticated, otherwise a "not signed in" fallback (real redirect wired in FDM-13).

- [ ] **Step 1: Failing test**

Create `apps/web/src/auth/use-auth.spec.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer } from '../lib/di/container';
import { ContainerProvider } from '../lib/di/react';
import { useAuth } from './use-auth';

function Harness() {
  const { user, isAuthenticated, login } = useAuth();
  return (
    <div>
      <span>auth:{String(isAuthenticated)}</span>
      <span>email:{user?.email ?? '-'}</span>
      <button onClick={() => login('a@b.com', 'pw')}>login</button>
    </div>
  );
}

function renderWithFakeApi() {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  // Fake the network: /auth/me 401 until login, then a user.
  let loggedIn = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/login')) {
      loggedIn = true;
      return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    }
    if (url.endsWith('/auth/refresh')) return new Response(null, { status: 401 });
    if (url.endsWith('/auth/me')) {
      return loggedIn
        ? new Response(JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }), { status: 200 })
        : new Response(null, { status: 401 });
    }
    return new Response(null, { status: 404 });
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ContainerProvider container={di}>
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>
    </ContainerProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

it('reflects unauthenticated then authenticated after login', async () => {
  renderWithFakeApi();
  await waitFor(() => expect(screen.getByText('auth:false')).toBeInTheDocument());
  await userEvent.click(screen.getByText('login'));
  await waitFor(() => expect(screen.getByText('email:a@b.com')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- use-auth`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement useAuth**

Create `apps/web/src/auth/use-auth.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useService } from '../lib/di/react';

export function useAuth() {
  const authService = useService((c) => c.authService);
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.currentUser(),
    retry: false,
    staleTime: 30_000,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.login(email, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => qc.setQueryData(['me'], null),
  });

  return {
    user: meQuery.data ?? undefined,
    isLoading: meQuery.isLoading,
    isAuthenticated: !!meQuery.data,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
  };
}
```

- [ ] **Step 4: Implement RequireAuth**

Create `apps/web/src/auth/require-auth.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useAuth } from './use-auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <p>Загрузка…</p>;
  if (!isAuthenticated) return <p>Вы не вошли в систему.</p>;
  return <>{children}</>;
}
```

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- use-auth`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth/use-auth.ts apps/web/src/auth/require-auth.tsx apps/web/src/auth/use-auth.spec.tsx
git commit -m "feat(web): useAuth (TanStack Query over injected authService) + RequireAuth"
```

---

## Task 10: Design-system port (tokens + primitives)

**Files:** Modify `apps/web/src/index.css` (port `@theme` tokens from `reference/web-reference/src/index.css`); Create `apps/web/src/ui/{button.tsx,input.tsx,card.tsx}`, `apps/web/src/ui/button.spec.tsx`.

**Interfaces:**
- Produces: `Button`, `Input`, `Card` primitives styled with the ported tokens (coral accent). Minimal, typed props.

- [ ] **Step 1: Port tokens**

Read `reference/web-reference/src/index.css` and copy its `@theme { ... }` token block (colors incl. the coral accent `#fb5d5d → #ff8e72`, radius, fonts) into `apps/web/src/index.css` after the `@import 'tailwindcss';` line. Keep it verbatim except drop any rules that reference components not ported.

- [ ] **Step 2: Failing test**

Create `apps/web/src/ui/button.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';

it('renders a button with its label and type', () => {
  render(<Button>Продолжить</Button>);
  const btn = screen.getByRole('button', { name: 'Продолжить' });
  expect(btn).toHaveAttribute('type', 'button');
});
```

- [ ] **Step 3: Run → fail**

Run: `npm test -w @friends-ai/web -- button`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement primitives**

Create `apps/web/src/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';

export function Button({ type = 'button', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium text-white bg-[#fb5d5d] hover:bg-[#ff8e72] disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
```

Create `apps/web/src/ui/input.tsx`:

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-lg border border-neutral-200 px-3 py-2 outline-none focus:border-[#fb5d5d] ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

Create `apps/web/src/ui/card.tsx`:

```tsx
import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl border border-neutral-200 bg-white p-6 ${className}`} {...props} />;
}
```

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- button && npm run build -w @friends-ai/web`
Expected: PASS; build (with Tailwind + tokens) succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css apps/web/src/ui
git commit -m "feat(web): port design tokens + Button/Input/Card primitives"
```

---

## Task 11: App shell + providers + routes + connection proof

**Files:** Modify `apps/web/src/App.tsx`, `apps/web/src/smoke.spec.tsx`; Create `apps/web/src/routes/{router.tsx,app-shell.tsx,home.route.tsx}`, `apps/web/src/lib/query.ts`.

**Interfaces:**
- Consumes: everything above.
- Produces: `App` wiring `ContainerProvider(createAppContainer({ apiBaseUrl: '/api/v1' }))` → `QueryClientProvider` → `RouterProvider`; a home route that shows the current user (`useAuth`) or "not signed in" — the connection proof against the backend (through the Vite proxy).

- [ ] **Step 1: Query client singleton**

Create `apps/web/src/lib/query.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
}
```

- [ ] **Step 2: Routes**

Create `apps/web/src/routes/home.route.tsx`:

```tsx
import { useAuth } from '../auth/use-auth';
import { Card } from '../ui/card';

export function HomeRoute() {
  const { user, isLoading, isAuthenticated } = useAuth();
  return (
    <Card>
      <h1 className="text-xl font-medium">friends.ai</h1>
      {isLoading ? (
        <p>Загрузка…</p>
      ) : isAuthenticated ? (
        <p>Вы вошли как {user?.email}</p>
      ) : (
        <p>Вы не вошли в систему.</p>
      )}
    </Card>
  );
}
```

Create `apps/web/src/routes/app-shell.tsx`:

```tsx
import { Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <Outlet />
    </div>
  );
}
```

Create `apps/web/src/routes/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './app-shell';
import { HomeRoute } from './home.route';

export const router = createBrowserRouter([
  { path: '/', element: <AppShell />, children: [{ index: true, element: <HomeRoute /> }] },
]);
```

- [ ] **Step 3: App wiring + update smoke test**

Replace `apps/web/src/App.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer } from './lib/di/container';
import { ContainerProvider } from './lib/di/react';
import { createQueryClient } from './lib/query';
import { router } from './routes/router';

const container = createAppContainer({ apiBaseUrl: '/api/v1' });
const queryClient = createQueryClient();

export function App() {
  return (
    <ContainerProvider container={container}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ContainerProvider>
  );
}
```

Replace `apps/web/src/smoke.spec.tsx` (App now does real fetches on mount — stub them):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

afterEach(() => vi.restoreAllMocks());

it('renders the shell and resolves to "not signed in" against a 401 backend', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  render(<App />);
  await waitFor(() => expect(screen.getByText('Вы не вошли в систему.')).toBeInTheDocument());
});
```

- [ ] **Step 4: Run → pass (full web suite + build)**

Run: `npm test -w @friends-ai/web && npm run build -w @friends-ai/web && npm run typecheck -w @friends-ai/web`
Expected: all specs pass; build + typecheck clean.

- [ ] **Step 5: Verify against the running backend (manual proof)**

```bash
cp .env.example .env && docker compose up -d --build   # backend on :3000
npm run dev -w @friends-ai/web                          # SPA on :5173 (proxy /api → :3000)
# Open http://localhost:5173 → shows "Вы не вошли в систему." with no console/network errors;
# Network tab shows GET /api/v1/auth/me → 401 (proxied), i.e. the client reaches the API.
docker compose down
```

Expected: home renders; `/api/v1/auth/me` round-trips through the proxy (401 when signed out). Capture a screenshot for the PR.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): app shell + providers + routes + connection proof"
```

---

## Self-Review

**Spec coverage (FDM-12 acceptance criteria):**
- apps/web scaffolded (React+Vite+TS), builds/dev-runs, in CI → Task 1. ✅
- Routing + app shell → Task 11. ✅
- Typed API client via contracts types + thin fetch, base URL from env-ish (`/api/v1` + Vite proxy), credentials for the refresh cookie → Tasks 6, 11 (+ proxy in Task 1). ✅
- Auth shell: access token in memory + refresh via cookie + 401→refresh→retry + `useAuth`/current user → Tasks 4–9. ✅
- **DI container (dikon) holding business logic, provided app-wide** → Tasks 2, 3, 8 (vendored dikon, container, React glue, full wiring). ✅
- Design tokens + primitives ported from reference → Task 10. ✅
- launch.json → apps/web → Task 1. ✅
- No real screens (only shell + connection proof) — matches the FDM-12/FDM-13 split. ✅

**Placeholder scan:** every step has concrete code/commands. Task 2 vendors dikon via a pinned raw URL (reproducible), Task 10 ports the `@theme` block from a named existing file (concrete source).

**Type consistency:** service factory signatures (`createTokenStore`, `createRefreshSession({config,tokenStore})`, `createHttpClient({config,tokenStore,refreshSession})`, `createAuthApi({httpClient})`, `createAuthService({authApi,tokenStore,refreshSession})`) match their consumers in the container (Task 8) and `useAuth` (Task 9). `HttpClient.request<T>`, `AuthApi`, `AuthService`, `AppContainer`, `useService` names are used consistently. Contracts imports (`AuthTokens`, `MeResponse`) match the package.

**DI acyclicity:** `config → tokenStore → refreshSession → httpClient → authApi → authService` — verified linear; the http client's 401 path uses `refreshSession` (bare fetch), never `authService`.

**Out of scope (FDM-13 / later):** register/verify/login/reset screens, forms with react-hook-form+zod wiring to real endpoints, OpenAPI-generated client, route-scoped child containers, Playwright e2e.

## Execution Handoff

*(Filled in at handoff after review.)*
