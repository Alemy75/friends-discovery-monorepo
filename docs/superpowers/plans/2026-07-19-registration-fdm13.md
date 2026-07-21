# Registration Flow (FDM-13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the working registration flow in `apps/web` — register → verify email → auto-login → authenticated home — wired to the FDM-5 backend through the FDM-12 DI/auth foundation, testable end-to-end in the browser.

**Architecture:** Three route-based screens (`/register`, `/verify`, `/login`) built on the ported UI primitives, using react-hook-form + zod for forms. All auth actions go through `useAuth()` (extended with `register`/`verifyEmail`) → the injected `authService`; screens never call `fetch` or import `dikon`. Register carries `{email,password}` in in-memory router navigation state to `/verify`; on successful verify the flow auto-logs-in and lands on `/`, which is wrapped in `RequireAuth` (now redirecting to `/login` when unauthenticated).

**Tech Stack:** React 18, react-router-dom 6, @tanstack/react-query 5, react-hook-form 7 + zod + @hookform/resolvers, Tailwind v4 tokens, Vitest + @testing-library/react + user-event.

## Global Constraints

- Screens get auth behavior only through `useAuth()` / `useService(...)`; no direct `fetch`, no `dikon` import in components.
- Forms use react-hook-form + `zodResolver`; validation schemas in `apps/web/src/auth/schemas.ts`.
- Styling uses the ported token utilities only (`bg-canvas`/`bg-paper`/`text-ink`/`text-mid-gray`/`border-hairline`/`bg-accent`/`rounded-card`/`rounded-pill`/`shadow-card`/`font-geist`) — no hardcoded hex, no default Tailwind neutrals.
- API base is `/api/v1` via the existing httpClient; access token in memory, refresh cookie httpOnly (unchanged from FDM-12).
- Error copy is user-facing Russian; map `HttpError.status`: register 409→"Этот email уже зарегистрирован" / 400→"Проверьте email и пароль"; verify 400→"Неверный или просроченный код"; login 401→"Неверный email или пароль"; unknown→"Что-то пошло не так, попробуйте ещё раз".
- TS strict; TDD (failing test first); tests via Vitest + Testing Library (jsdom), fetch mocked. No Docker for tests.
- YAGNI: no password-reset UI, no social login, no onboarding/account-type — separate tasks.
- Every task ends on green tests + a commit.

## File Structure

```
apps/web/src/
  test/render.tsx              # renderWithProviders(ui, {route}) + mockFetch helper (NEW, shared test util)
  auth/
    schemas.ts                 # zod registerSchema / codeSchema / loginSchema (NEW)
    auth-error.ts              # authErrorMessage(err, map, fallback) (NEW)
    auth-card.tsx              # centered card layout: title/subtitle/children/footer (NEW)
    use-auth.ts                # (MODIFY) + register, verifyEmail mutations
    require-auth.tsx           # (MODIFY) redirect to /login when unauthenticated
  routes/
    register.route.tsx         # RegisterScreen (NEW)
    verify.route.tsx           # VerifyScreen (NEW)
    login.route.tsx            # LoginScreen (NEW)
    home.route.tsx             # (MODIFY) show user + logout button
    router.tsx                 # (MODIFY) add /register /verify /login; wrap / in RequireAuth
```

---

## Task 1: Extend useAuth with register + verifyEmail

**Files:**
- Modify: `apps/web/src/auth/use-auth.ts`
- Test: `apps/web/src/auth/use-auth.spec.tsx` (extend)

**Interfaces:**
- Consumes: `useService`, `authService.register/verifyEmail` (FDM-12).
- Produces: `useAuth()` additionally returns `register(email,password): Promise<void>` and `verifyEmail(email,code): Promise<void>` (both `mutateAsync` wrappers that reject on `HttpError`).

- [ ] **Step 1: Write the failing test**

Append to `apps/web/src/auth/use-auth.spec.tsx` a test that renders a harness calling `register`, and asserts `POST /auth/register` was hit:

```tsx
it('register() calls the backend register endpoint', async () => {
  const di = createAppContainer({ apiBaseUrl: '/api/v1' });
  const calls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    calls.push(String(input));
    return new Response(null, { status: 201 });
  });
  function H() {
    const { register } = useAuth();
    return <button onClick={() => register('a@b.com', 'password123')}>go</button>;
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ContainerProvider container={di}>
      <QueryClientProvider client={qc}>
        <H />
      </QueryClientProvider>
    </ContainerProvider>,
  );
  await userEvent.click(screen.getByText('go'));
  await waitFor(() => expect(calls.some((u) => u.endsWith('/auth/register'))).toBe(true));
});
```

(Ensure the file imports `userEvent` from `@testing-library/user-event` if not already.)

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- use-auth`
Expected: FAIL — `register is not a function`.

- [ ] **Step 3: Implement**

Replace `apps/web/src/auth/use-auth.ts` with:

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

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.register(email, password),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      authService.verifyEmail(email, code),
  });

  return {
    user: meQuery.data ?? undefined,
    isLoading: meQuery.isLoading,
    isAuthenticated: !!meQuery.data,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
    register: (email: string, password: string) => registerMutation.mutateAsync({ email, password }),
    verifyEmail: (email: string, code: string) => verifyMutation.mutateAsync({ email, code }),
  };
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test -w @friends-ai/web -- use-auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/use-auth.ts apps/web/src/auth/use-auth.spec.tsx
git commit -m "feat(web): useAuth register + verifyEmail mutations"
```

---

## Task 2: Test render helper, zod schemas, error mapper, AuthCard

**Files:**
- Create: `apps/web/src/test/render.tsx`, `apps/web/src/auth/schemas.ts`, `apps/web/src/auth/auth-error.ts`, `apps/web/src/auth/auth-card.tsx`
- Test: `apps/web/src/auth/schemas.spec.ts`, `apps/web/src/auth/auth-error.spec.ts`

**Interfaces:**
- Produces:
  - `renderWithProviders(ui, { route?, container? })` — wraps `ui` in `ContainerProvider` + `QueryClientProvider` + a `MemoryRouter` (initial entry `route ?? '/'`); returns RTL result plus `{ container }`.
  - `registerSchema` `{email: string().email(), password: string().min(8)}`, `codeSchema` `{code: string().length(6)}`, `loginSchema` `{email: string().email(), password: string().min(1)}`.
  - `authErrorMessage(err: unknown, map: Record<number,string>, fallback?: string): string`.
  - `<AuthCard title subtitle? footer?>{children}</AuthCard>` — centered layout.

- [ ] **Step 1: Failing tests**

Create `apps/web/src/auth/schemas.spec.ts`:

```ts
import { registerSchema, codeSchema, loginSchema } from './schemas';

it('registerSchema requires a valid email and 8+ char password', () => {
  expect(registerSchema.safeParse({ email: 'a@b.com', password: 'password123' }).success).toBe(true);
  expect(registerSchema.safeParse({ email: 'x', password: 'password123' }).success).toBe(false);
  expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
});

it('codeSchema requires exactly 6 chars', () => {
  expect(codeSchema.safeParse({ code: '123456' }).success).toBe(true);
  expect(codeSchema.safeParse({ code: '123' }).success).toBe(false);
});

it('loginSchema requires a valid email and non-empty password', () => {
  expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
});
```

Create `apps/web/src/auth/auth-error.spec.ts`:

```ts
import { HttpError } from '../lib/api/http-client';
import { authErrorMessage } from './auth-error';

it('maps a known status to its message', () => {
  expect(authErrorMessage(new HttpError(409, null), { 409: 'занят' })).toBe('занят');
});
it('falls back for unknown status or non-HttpError', () => {
  expect(authErrorMessage(new HttpError(500, null), { 409: 'занят' }, 'упс')).toBe('упс');
  expect(authErrorMessage(new Error('x'), { 409: 'занят' }, 'упс')).toBe('упс');
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- schemas auth-error`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement schemas + error mapper**

Create `apps/web/src/auth/schemas.ts`:

```ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export const codeSchema = z.object({ code: z.string().length(6) });
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterValues = z.infer<typeof registerSchema>;
export type CodeValues = z.infer<typeof codeSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
```

Create `apps/web/src/auth/auth-error.ts`:

```ts
import { HttpError } from '../lib/api/http-client';

export function authErrorMessage(
  err: unknown,
  map: Record<number, string>,
  fallback = 'Что-то пошло не так, попробуйте ещё раз',
): string {
  if (err instanceof HttpError && map[err.status]) return map[err.status];
  return fallback;
}
```

- [ ] **Step 4: Implement AuthCard + render helper**

Create `apps/web/src/auth/auth-card.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Card } from '../ui/card';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-geist font-medium text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 font-geist text-mid-gray">{subtitle}</p> : null}
        </div>
        <Card>{children}</Card>
        {footer ? <p className="mt-5 text-center text-sm font-geist text-mid-gray">{footer}</p> : null}
      </div>
    </div>
  );
}
```

Create `apps/web/src/test/render.tsx`:

```tsx
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppContainer, type AppContainer } from '../lib/di/container';
import { ContainerProvider } from '../lib/di/react';

export function renderWithProviders(
  ui: ReactElement,
  opts: { route?: string; container?: AppContainer } = {},
) {
  const container = opts.container ?? createAppContainer({ apiBaseUrl: '/api/v1' });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <ContainerProvider container={container}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[opts.route ?? '/']}>{ui}</MemoryRouter>
      </QueryClientProvider>
    </ContainerProvider>,
  );
  return { ...result, container };
}
```

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- schemas auth-error`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/test/render.tsx apps/web/src/auth/schemas.ts apps/web/src/auth/auth-error.ts apps/web/src/auth/auth-card.tsx apps/web/src/auth/schemas.spec.ts apps/web/src/auth/auth-error.spec.ts
git commit -m "feat(web): auth schemas, error mapper, AuthCard, test render helper"
```

---

## Task 3: Register screen + /register route

**Files:**
- Create: `apps/web/src/routes/register.route.tsx`
- Modify: `apps/web/src/routes/router.tsx`
- Test: `apps/web/src/routes/register.route.spec.tsx`

**Interfaces:**
- Consumes: `useAuth().register`, `registerSchema`, `authErrorMessage`, `AuthCard`, `Input`, `Button`, react-router `useNavigate`.
- Produces: `RegisterScreen` at `/register`; on success `navigate('/verify', { state: { email, password } })`.

- [ ] **Step 1: Failing test**

Create `apps/web/src/routes/register.route.spec.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { RegisterScreen } from './register.route';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/verify" element={<div>verify-step</div>} />
    </Routes>
  );
}

it('registers and advances to the verify step', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 201 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  await waitFor(() => expect(screen.getByText('verify-step')).toBeInTheDocument());
});

it('shows a 409 error message when the email is taken', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({}), { status: 409 }));
  renderWithProviders(tree(), { route: '/register' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
  await waitFor(() => expect(screen.getByText('Этот email уже зарегистрирован')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- register.route`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `apps/web/src/routes/register.route.tsx`:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { registerSchema, type RegisterValues } from '../auth/schemas';
import { authErrorMessage } from '../auth/auth-error';
import { AuthCard } from '../auth/auth-card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function RegisterScreen() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await registerUser(email, password);
      navigate('/verify', { state: { email, password } });
    } catch (err) {
      setFormError(authErrorMessage(err, { 409: 'Этот email уже зарегистрирован', 400: 'Проверьте email и пароль' }));
    }
  });

  return (
    <AuthCard
      title="Создайте аккаунт"
      subtitle="Пара шагов — и можно искать друзей."
      footer={<>Уже есть аккаунт? <Link to="/login" className="text-ink font-medium underline underline-offset-2">Войти</Link></>}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Email
          <Input type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className="text-xs text-ember">Введите корректный email</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Пароль
          <Input type="password" autoComplete="new-password" {...register('password')} />
          {errors.password ? <span className="text-xs text-ember">Минимум 8 символов</span> : null}
        </label>
        {formError ? <p className="text-sm text-ember">{formError}</p> : null}
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>Продолжить</Button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 4: Wire the route**

Update `apps/web/src/routes/router.tsx` to add the route (keep existing home):

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './app-shell';
import { HomeRoute } from './home.route';
import { RegisterScreen } from './register.route';

export const router = createBrowserRouter([
  { path: '/register', element: <RegisterScreen /> },
  { path: '/', element: <AppShell />, children: [{ index: true, element: <HomeRoute /> }] },
]);
```

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- register.route`
Expected: PASS (advances to verify; shows 409 message).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/register.route.tsx apps/web/src/routes/register.route.spec.tsx apps/web/src/routes/router.tsx
git commit -m "feat(web): registration screen + /register route"
```

---

## Task 4: Verify screen + /verify route (auto-login)

**Files:**
- Create: `apps/web/src/routes/verify.route.tsx`
- Modify: `apps/web/src/routes/router.tsx`
- Test: `apps/web/src/routes/verify.route.spec.tsx`

**Interfaces:**
- Consumes: `useAuth().verifyEmail`+`login`, `codeSchema`, `authErrorMessage`, `AuthCard`, react-router `useLocation`/`useNavigate`/`Navigate`.
- Produces: `VerifyScreen` at `/verify`; reads `{email,password}` from `location.state`; missing email → `<Navigate to="/register" replace />`; on success verify → auto-login → `navigate('/')`.

- [ ] **Step 1: Failing test**

Create `apps/web/src/routes/verify.route.spec.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { renderWithProviders } from '../test/render';
import { VerifyScreen } from './verify.route';

afterEach(() => vi.restoreAllMocks());

// Helper route that pushes to /verify WITH navigation state.
function Seed() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/verify', { state: { email: 'a@b.com', password: 'password123' } });
  }, [navigate]);
  return null;
}

function tree() {
  return (
    <Routes>
      <Route path="/" element={<Seed />} />
      <Route path="/verify" element={<VerifyScreen />} />
      <Route path="/home" element={<div>home</div>} />
    </Routes>
  );
}

it('verifies the code, auto-logs-in, and lands home', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/verify-email')) return new Response(null, { status: 204 });
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    return new Response(null, { status: 404 });
  });
  // Render VerifyScreen navigating to "/" after login (map "/" → home marker via a dedicated route):
  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument());
  await userEvent.type(screen.getByLabelText('Код из письма'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));
  await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
});

it('redirects to /register when there is no email in navigation state', async () => {
  renderWithProviders(
    <Routes>
      <Route path="/verify" element={<VerifyScreen />} />
      <Route path="/register" element={<div>register-screen</div>} />
    </Routes>,
    { route: '/verify' },
  );
  await waitFor(() => expect(screen.getByText('register-screen')).toBeInTheDocument());
});
```

Note: in the first test the screen navigates to `/` on success; add a `/` route rendering `home` — adjust `tree()` so `/` after login shows home. Simplest: have VerifyScreen navigate to `/` and register `<Route path="/" element={<div>home</div>} />` as the post-login target (the `Seed` component only runs once on mount; after login navigate('/') lands on the home marker). Ensure the test's `Routes` has `/` → home marker and Seed is triggered via initial `route: '/register-seed'`. Implement the test so the login success path asserts the home marker renders.

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- verify.route`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `apps/web/src/routes/verify.route.tsx`:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { codeSchema, type CodeValues } from '../auth/schemas';
import { authErrorMessage } from '../auth/auth-error';
import { AuthCard } from '../auth/auth-card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface VerifyState {
  email?: string;
  password?: string;
}

export function VerifyScreen() {
  const { verifyEmail, login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as VerifyState;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeValues>({ resolver: zodResolver(codeSchema) });

  if (!state.email || !state.password) return <Navigate to="/register" replace />;
  const { email, password } = state;

  const onSubmit = handleSubmit(async ({ code }) => {
    setFormError(null);
    try {
      await verifyEmail(email, code);
      await login(email, password);
      navigate('/');
    } catch (err) {
      setFormError(authErrorMessage(err, { 400: 'Неверный или просроченный код' }));
    }
  });

  return (
    <AuthCard title="Подтвердите email" subtitle={`Мы отправили код на ${email}`}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Код из письма
          <Input inputMode="numeric" autoComplete="one-time-code" {...register('code')} />
          {errors.code ? <span className="text-xs text-ember">Введите 6-значный код</span> : null}
        </label>
        {formError ? <p className="text-sm text-ember">{formError}</p> : null}
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>Подтвердить</Button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 4: Wire the route**

Add to `apps/web/src/routes/router.tsx` imports + routes: `import { VerifyScreen } from './verify.route';` and `{ path: '/verify', element: <VerifyScreen /> },` (before the `/` route).

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- verify.route`
Expected: PASS (verify→auto-login→home; missing-state redirects to /register).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/verify.route.tsx apps/web/src/routes/verify.route.spec.tsx apps/web/src/routes/router.tsx
git commit -m "feat(web): verify-email screen + auto-login + /verify route"
```

---

## Task 5: Login screen + /login route

**Files:**
- Create: `apps/web/src/routes/login.route.tsx`
- Modify: `apps/web/src/routes/router.tsx`
- Test: `apps/web/src/routes/login.route.spec.tsx`

**Interfaces:**
- Consumes: `useAuth().login`, `loginSchema`, `authErrorMessage`, `AuthCard`.
- Produces: `LoginScreen` at `/login`; on success `navigate('/')`; 401 → error message.

- [ ] **Step 1: Failing test**

Create `apps/web/src/routes/login.route.spec.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { LoginScreen } from './login.route';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/" element={<div>home</div>} />
    </Routes>
  );
}

it('logs in and lands home', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 });
    return new Response(null, { status: 404 });
  });
  renderWithProviders(tree(), { route: '/login' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
});

it('shows a 401 error on bad credentials', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).endsWith('/auth/login') ? new Response(null, { status: 401 }) : new Response(null, { status: 404 }),
  );
  renderWithProviders(tree(), { route: '/login' });
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'nope1234');
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await waitFor(() => expect(screen.getByText('Неверный email или пароль')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test -w @friends-ai/web -- login.route`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `apps/web/src/routes/login.route.tsx`:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { loginSchema, type LoginValues } from '../auth/schemas';
import { authErrorMessage } from '../auth/auth-error';
import { AuthCard } from '../auth/auth-card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setFormError(authErrorMessage(err, { 401: 'Неверный email или пароль' }));
    }
  });

  return (
    <AuthCard
      title="С возвращением"
      subtitle="Войдите, чтобы продолжить."
      footer={<>Впервые здесь? <Link to="/register" className="text-ink font-medium underline underline-offset-2">Создать аккаунт</Link></>}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Email
          <Input type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <span className="text-xs text-ember">Введите корректный email</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-sm font-geist text-mid-gray">
          Пароль
          <Input type="password" autoComplete="current-password" {...register('password')} />
          {errors.password ? <span className="text-xs text-ember">Введите пароль</span> : null}
        </label>
        {formError ? <p className="text-sm text-ember">{formError}</p> : null}
        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>Войти</Button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 4: Wire the route**

Add to `apps/web/src/routes/router.tsx`: `import { LoginScreen } from './login.route';` and `{ path: '/login', element: <LoginScreen /> },`.

- [ ] **Step 5: Run → pass**

Run: `npm test -w @friends-ai/web -- login.route`
Expected: PASS (login→home; 401 message).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/login.route.tsx apps/web/src/routes/login.route.spec.tsx apps/web/src/routes/router.tsx
git commit -m "feat(web): login screen + /login route"
```

---

## Task 6: Protect home (RequireAuth redirect) + logout + full-flow test

**Files:**
- Modify: `apps/web/src/auth/require-auth.tsx`, `apps/web/src/auth/require-auth.spec.tsx`, `apps/web/src/routes/home.route.tsx`, `apps/web/src/routes/router.tsx`
- Test: `apps/web/src/routes/auth-flow.spec.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `/` wrapped in `RequireAuth` (redirects to `/login` when unauthenticated); `HomeRoute` shows the user + a logout button that logs out and returns to `/login`; a full register→verify→auto-login→home flow test.

- [ ] **Step 1: RequireAuth → redirect**

Replace `apps/web/src/auth/require-auth.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './use-auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <p>Загрузка…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

Update `apps/web/src/auth/require-auth.spec.tsx` — the unauthenticated case now redirects instead of rendering text. Rewrite it to render `RequireAuth` inside a `MemoryRouter` with a `/login` route and assert the login marker appears when `/auth/me` → 401, and children appear when `/auth/me` → 200:

```tsx
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { RequireAuth } from './require-auth';

afterEach(() => vi.restoreAllMocks());

function tree() {
  return (
    <Routes>
      <Route path="/" element={<RequireAuth><div>secret</div></RequireAuth>} />
      <Route path="/login" element={<div>login-screen</div>} />
    </Routes>
  );
}

it('redirects to /login when unauthenticated', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByText('login-screen')).toBeInTheDocument());
});

it('renders children when authenticated', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }), { status: 200 }),
  );
  renderWithProviders(tree(), { route: '/' });
  await waitFor(() => expect(screen.getByText('secret')).toBeInTheDocument());
});
```

- [ ] **Step 2: HomeRoute + logout**

Replace `apps/web/src/routes/home.route.tsx`:

```tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/use-auth';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export function HomeRoute() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <Card>
      <h1 className="text-xl font-geist font-medium text-ink">friends.ai</h1>
      <p className="mt-2 font-geist text-mid-gray">Вы вошли как {user?.email}</p>
      <Button
        type="button"
        className="mt-4"
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
      >
        Выйти
      </Button>
    </Card>
  );
}
```

- [ ] **Step 3: Wire RequireAuth into the router**

Replace `apps/web/src/routes/router.tsx` (final wiring):

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '../auth/require-auth';
import { AppShell } from './app-shell';
import { HomeRoute } from './home.route';
import { RegisterScreen } from './register.route';
import { VerifyScreen } from './verify.route';
import { LoginScreen } from './login.route';

export const router = createBrowserRouter([
  { path: '/register', element: <RegisterScreen /> },
  { path: '/verify', element: <VerifyScreen /> },
  { path: '/login', element: <LoginScreen /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [{ index: true, element: <HomeRoute /> }],
  },
]);
```

- [ ] **Step 4: Full-flow failing test**

Create `apps/web/src/routes/auth-flow.spec.tsx` — drive register→verify→auto-login→home over a `MemoryRouter` with a stateful fetch mock (unverified until verify; me returns user only after login):

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '../test/render';
import { RegisterScreen } from './register.route';
import { VerifyScreen } from './verify.route';

afterEach(() => vi.restoreAllMocks());

it('register → verify → auto-login → home', async () => {
  let loggedIn = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith('/auth/register')) return new Response(null, { status: 201 });
    if (url.endsWith('/auth/verify-email')) return new Response(null, { status: 204 });
    if (url.endsWith('/auth/login')) { loggedIn = true; return new Response(JSON.stringify({ accessToken: 'acc' }), { status: 200 }); }
    if (url.endsWith('/auth/me')) return loggedIn
      ? new Response(JSON.stringify({ id: '1', email: 'a@b.com', role: 'user', status: 'active', emailVerified: true }), { status: 200 })
      : new Response(null, { status: 401 });
    return new Response(null, { status: 404 });
  });

  renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/verify" element={<VerifyScreen />} />
      <Route path="/" element={<div>home-landing</div>} />
    </Routes>,
    { route: '/register' },
  );

  await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
  await userEvent.type(screen.getByLabelText('Пароль'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument());
  await userEvent.type(screen.getByLabelText('Код из письма'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }));

  await waitFor(() => expect(screen.getByText('home-landing')).toBeInTheDocument());
});
```

- [ ] **Step 5: Run → pass (full suite + build + typecheck + lint)**

```bash
npm test -w @friends-ai/web && npm run typecheck -w @friends-ai/web && npm run lint -w @friends-ai/web && npm run build -w @friends-ai/web
```
Expected: all green (all new screen specs + flow + updated require-auth spec; existing FDM-12 specs unaffected).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth/require-auth.tsx apps/web/src/auth/require-auth.spec.tsx apps/web/src/routes/home.route.tsx apps/web/src/routes/router.tsx apps/web/src/routes/auth-flow.spec.tsx
git commit -m "feat(web): protect home with RequireAuth redirect, logout, full register flow"
```

---

## Self-Review

**Spec coverage (FDM-13 acceptance criteria):**
- Register screen → `POST /auth/register`, 409/400 handling → Task 3. ✅
- Verify-email screen → `POST /auth/verify-email`, 400 handling → Task 4. ✅
- Auto-login after verify → Task 4 (login with carried creds). ✅
- Login screen → `POST /auth/login`, 401 handling → Task 5. ✅
- Authenticated landing shows `/auth/me` + logout → Task 6 (HomeRoute). ✅
- `RequireAuth` protects `/`, redirects to `/login` → Task 6 (finally wires the FDM-12 guard). ✅
- Loading + error states → each screen (isSubmitting/formError) + RequireAuth loader. ✅
- Captcha slot inert → backend captcha off in dev; no captcha UI needed (documented, YAGNI). ✅
- Works end-to-end in the browser → automated full-flow test (Task 6) + manual live proof (below). ✅

**Placeholder scan:** all steps have concrete code. Task 4 Step 1 carries a prose note about arranging the test's `/` home marker — the code block is complete; the note only clarifies the post-login target route.

**Type consistency:** `useAuth()` surface (`login/logout/register/verifyEmail/user/isAuthenticated/isLoading`) defined in Task 1, consumed in Tasks 3–6. `registerSchema/codeSchema/loginSchema` + `RegisterValues/CodeValues/LoginValues` (Task 2) match their `useForm<...>` usages. `authErrorMessage(err, map, fallback?)` signature consistent. `renderWithProviders(ui, {route, container})` consistent across specs. `AuthCard` props (`title/subtitle/children/footer`) consistent. Route paths `/register`,`/verify`,`/login`,`/` consistent across screens + router.

**Manual live proof (post-merge / verification):** `docker compose up -d --build` (backend), `npm run dev -w @friends-ai/web`, open `:5173` → redirected to `/login` → "Создать аккаунт" → register → read the 6-digit code from `docker compose logs api` (dev mailer logs it) → verify → lands on home as the registered user. Capture screenshots.

## Execution Handoff

*(Filled in at handoff after review.)*
