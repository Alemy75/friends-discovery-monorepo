# Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo skeleton and a bootable NestJS API that connects to PostgreSQL (via Prisma) and Redis, exposes a real health check, validates its config at boot, and runs an e2e test suite against real containers — all reproducible via Docker Compose and CI.

**Architecture:** npm-workspaces monorepo. The existing React/Vite SPA is preserved verbatim under `reference/` (the design reference — the production SPA is rewritten later in its own plan). New code lives in `apps/api` (NestJS modular monolith) and `packages/contracts` (shared TS enums/DTOs). The API boots behind a global `/api/v1` prefix, with an unversioned `/health` for the load balancer. PostgreSQL is accessed only through a single `PrismaService`; Redis only through a single `RedisService`. Integration/e2e tests spin ephemeral Postgres/Redis via Testcontainers so they need no shared dev database.

**Tech Stack:** Node.js ≥20, TypeScript 5, NestJS 10, Prisma 5 + `@prisma/client`, PostgreSQL 16, `ioredis` + Redis 7, `@nestjs/terminus` (health), `zod` (config validation), Jest + Supertest, `@testcontainers/postgresql` + `@testcontainers/redis`, Docker Compose, GitHub Actions.

## Global Constraints

- Node.js **≥ 20** — set in root `package.json` `engines.node`.
- Language: **TypeScript**, `strict: true` in every tsconfig.
- All HTTP routes served under global prefix **`/api/v1`**, EXCEPT `/health` which is excluded (unversioned, for the LB).
- **Config is validated at boot** with `zod`; an invalid/missing required env var must throw and prevent startup. Secrets live only in environment variables — never committed. `.env` is gitignored; `.env.example` documents every key.
- Database access **only** through `PrismaService`; Redis access **only** through `RedisService`. No module instantiates its own client.
- Every task ends on green tests and a commit. TDD: failing test first.
- Package manager: **npm** (workspaces). Commit `package-lock.json`.
- Shared cross-app types live in `packages/contracts` (published name `@friends-ai/contracts`); never duplicate an enum that belongs there.

---

## File Structure

```
friends-ai/
├─ package.json                      # workspace root (private, workspaces, engines, scripts)
├─ tsconfig.base.json                # shared strict TS config, extended by each package
├─ .env.example                      # documents every env key
├─ docker-compose.yml                # postgres, redis, minio, api
├─ .github/workflows/ci.yml          # lint → typecheck → test → build
├─ reference/web-reference/          # the existing SPA, moved verbatim (design reference)
├─ packages/
│  └─ contracts/
│     ├─ package.json                # @friends-ai/contracts, builds to dist/
│     ├─ tsconfig.json
│     ├─ src/index.ts                # barrel export
│     ├─ src/enums.ts                # AccountKind, Intent
│     └─ src/enums.spec.ts
└─ apps/
   └─ api/
      ├─ package.json                # @friends-ai/api
      ├─ tsconfig.json
      ├─ tsconfig.build.json
      ├─ nest-cli.json
      ├─ jest.config.ts              # unit tests (src/**/*.spec.ts)
      ├─ test/jest-e2e.config.ts     # e2e tests (test/**/*.e2e-spec.ts)
      ├─ test/testcontainers.ts      # shared Postgres/Redis container helpers
      ├─ Dockerfile
      ├─ prisma/schema.prisma        # City model + first migration
      └─ src/
         ├─ main.ts                  # bootstrap: prefix, validation pipe, listen
         ├─ app.module.ts            # root module wiring config/prisma/redis/health
         ├─ config/
         │  ├─ env.schema.ts         # zod schema + validate()
         │  ├─ config.module.ts
         │  └─ config.service.ts     # typed getters
         ├─ prisma/
         │  ├─ prisma.module.ts
         │  └─ prisma.service.ts
         ├─ redis/
         │  ├─ redis.module.ts
         │  └─ redis.service.ts
         │  └─ redis.health.ts       # custom Terminus indicator
         └─ health/
            ├─ health.module.ts
            └─ health.controller.ts
```

---

## Task 1: Monorepo skeleton + preserve reference + shared contracts

Establishes npm workspaces, archives the current SPA as a reference, and creates the `@friends-ai/contracts` package with the first shared enums and a passing unit test.

**Files:**
- Create: `package.json` (new workspace root — replaces the SPA's root package.json)
- Create: `tsconfig.base.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/enums.ts`
- Test: `packages/contracts/src/enums.spec.ts`
- Move: existing SPA files → `reference/web-reference/`

**Interfaces:**
- Consumes: nothing.
- Produces: package `@friends-ai/contracts` exporting `enum AccountKind { Single = 'single', Couple = 'couple' }` and `enum Intent { Walks='walks', DoubleDates='double-dates', Hobby='hobby', Travel='travel', DeepTalks='deep-talks', Events='events' }`. Built to `dist/index.js` (+ `.d.ts`).

- [ ] **Step 1: Archive the existing SPA under `reference/`**

```bash
mkdir -p reference/web-reference
git mv src index.html vite.config.ts tsconfig.json tsconfig.node.tsbuildinfo tsconfig.tsbuildinfo package.json package-lock.json reference/web-reference/ 2>/dev/null || true
# node_modules/ and dist/ are gitignored; move them too so the root is clean (untracked, so plain mv):
[ -d node_modules ] && mv node_modules reference/web-reference/ || true
[ -d dist ] && mv dist reference/web-reference/ || true
```

Point the preview launcher at the reference SPA so `run` still works:

Modify `.claude/launch.json` — set the existing config's working directory to the reference app. Replace its `configurations` entry with:

```json
{
  "name": "web-reference",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["--prefix", "reference/web-reference", "run", "dev"],
  "port": 5173
}
```

- [ ] **Step 2: Create the workspace root `package.json`**

Create `package.json`:

```json
{
  "name": "friends-ai",
  "private": true,
  "version": "0.1.0",
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=20" },
  "scripts": {
    "build:contracts": "npm run build -w @friends-ai/contracts",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present"
  }
}
```

- [ ] **Step 3: Create the shared base tsconfig**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- [ ] **Step 4: Scaffold the contracts package**

Create `packages/contracts/package.json`:

```json
{
  "name": "@friends-ai/contracts",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}
```

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "dist"]
}
```

Create `packages/contracts/jest.config.js`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
};
```

- [ ] **Step 5: Write the failing test**

Create `packages/contracts/src/enums.spec.ts`:

```ts
import { AccountKind, Intent } from './enums';

describe('contracts enums', () => {
  it('AccountKind has single and couple string values', () => {
    expect(AccountKind.Single).toBe('single');
    expect(AccountKind.Couple).toBe('couple');
  });

  it('Intent values match the reference domain', () => {
    expect(Object.values(Intent)).toEqual([
      'walks',
      'double-dates',
      'hobby',
      'travel',
      'deep-talks',
      'events',
    ]);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npm install
npm test -w @friends-ai/contracts
```

Expected: FAIL — `Cannot find module './enums'`.

- [ ] **Step 7: Implement the enums + barrel**

Create `packages/contracts/src/enums.ts`:

```ts
export enum AccountKind {
  Single = 'single',
  Couple = 'couple',
}

export enum Intent {
  Walks = 'walks',
  DoubleDates = 'double-dates',
  Hobby = 'hobby',
  Travel = 'travel',
  DeepTalks = 'deep-talks',
  Events = 'events',
}
```

Create `packages/contracts/src/index.ts`:

```ts
export * from './enums';
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
npm test -w @friends-ai/contracts
npm run build -w @friends-ai/contracts
```

Expected: tests PASS; `packages/contracts/dist/index.js` and `index.d.ts` exist.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: monorepo workspaces, archive SPA reference, add contracts package"
```

---

## Task 2: NestJS API bootstrap + health endpoint

Scaffolds `apps/api` as a NestJS app that boots on `/api/v1` and answers `GET /health` with `{ status: 'ok' }`, proven by a Supertest e2e test.

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/nest-cli.json`
- Create: `apps/api/jest.config.ts`, `apps/api/test/jest-e2e.config.ts`
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Create: `apps/api/src/health/health.module.ts`, `apps/api/src/health/health.controller.ts`
- Test: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing from other tasks yet.
- Produces: `AppModule` (root Nest module) and a bootable app; `HealthController` mapping `GET /health` → `{ status: 'ok' }` (route excluded from the global prefix). `main.ts` exports nothing; it calls `bootstrap()`.

- [ ] **Step 1: Scaffold `apps/api` package + configs**

Create `apps/api/package.json`:

```json
{
  "name": "@friends-ai/api",
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "test": "jest --config jest.config.ts",
    "test:e2e": "jest --config test/jest-e2e.config.ts --runInBand"
  },
  "dependencies": {
    "@friends-ai/contracts": "*",
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/schematics": "^10.1.4",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.16.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "typescript": "^5.6.3"
  }
}
```

Create `apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./",
    "outDir": "./dist",
    "baseUrl": "./",
    "sourceMap": true,
    "incremental": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

Create `apps/api/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.e2e-spec.ts"]
}
```

Create `apps/api/jest.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
};

export default config;
```

Create `apps/api/test/jest-e2e.config.ts`:

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: '.e2e-spec\\.ts$',
  testTimeout: 120000,
};

export default config;
```

- [ ] **Step 2: Write the failing e2e test**

Create `apps/api/test/health.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health → 200 { status: "ok" }', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('applies the /api/v1 prefix to normal routes (health is excluded)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm install
npm run test:e2e -w @friends-ai/api
```

Expected: FAIL — cannot find `../src/app.module`.

- [ ] **Step 4: Implement health module + controller**

Create `apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

Create `apps/api/src/health/health.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

Create `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';

@Module({ imports: [HealthModule] })
export class AppModule {}
```

- [ ] **Step 5: Implement the bootstrap**

Create `apps/api/src/main.ts`:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm run test:e2e -w @friends-ai/api
```

Expected: PASS (both cases).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): NestJS bootstrap with /api/v1 prefix and /health endpoint"
```

---

## Task 3: Config module with zod validation

Adds boot-time env validation and a typed `AppConfigService`. Missing required vars must throw before the app starts.

**Files:**
- Create: `apps/api/src/config/env.schema.ts`
- Create: `apps/api/src/config/config.service.ts`
- Create: `apps/api/src/config/config.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `AppConfigModule` globally)
- Modify: `apps/api/package.json` (add deps)
- Test: `apps/api/src/config/env.schema.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `validateEnv(raw: Record<string, unknown>): Env` — throws `Error` listing invalid keys on failure.
  - `type Env = { NODE_ENV: 'development'|'test'|'production'; PORT: number; DATABASE_URL: string; REDIS_URL: string }`.
  - Injectable `AppConfigService` with getters `nodeEnv`, `port`, `databaseUrl`, `redisUrl`.
  - `AppConfigModule` — global; provides `AppConfigService`.

- [ ] **Step 1: Add dependencies**

Add to `apps/api/package.json` dependencies:

```json
"@nestjs/config": "^3.2.3",
"zod": "^3.23.8"
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/config/env.schema.spec.ts`:

```ts
import { validateEnv } from './env.schema';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('validateEnv', () => {
  it('parses and coerces a valid environment', () => {
    const env = validateEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_URL).toBe('postgresql://u:p@localhost:5432/db');
  });

  it('throws when a required var is missing', () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is not a postgres url', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm install
npm test -w @friends-ai/api -- env.schema
```

Expected: FAIL — cannot find `./env.schema`.

- [ ] **Step 4: Implement the schema**

Create `apps/api/src/config/env.schema.ts`:

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  REDIS_URL: z.string().url().startsWith('redis://'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -w @friends-ai/api -- env.schema
```

Expected: PASS (all three cases).

- [ ] **Step 6: Implement the config service + global module**

Create `apps/api/src/config/config.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }
  get port(): number {
    return this.config.get('PORT', { infer: true });
  }
  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }
  get redisUrl(): string {
    return this.config.get('REDIS_URL', { infer: true });
  }
}
```

Create `apps/api/src/config/config.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';
import { AppConfigService } from './config.service';

@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv })],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
```

- [ ] **Step 7: Wire it into the app module**

Replace `apps/api/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [AppConfigModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 8: Run the full unit + e2e suite**

The e2e test boots `AppModule`, which now validates env. Provide env inline so it boots:

```bash
DATABASE_URL='postgresql://u:p@localhost:5432/db' REDIS_URL='redis://localhost:6379' NODE_ENV=test \
  npm run test:e2e -w @friends-ai/api
npm test -w @friends-ai/api
```

Expected: PASS. (Health e2e still green; env validation runs at module init.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(api): zod-validated config module with typed AppConfigService"
```

---

## Task 4: Prisma integration + City model + Testcontainers

Introduces Prisma with the first model (`City`, the multi-city axis), a single `PrismaService`, a first migration, and a shared Testcontainers Postgres helper. Proven by an integration test that migrates a throwaway Postgres and round-trips a `City` row.

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Create: `apps/api/test/testcontainers.ts`
- Modify: `apps/api/src/app.module.ts` (import `PrismaModule`)
- Modify: `apps/api/package.json` (add deps + prisma scripts)
- Test: `apps/api/test/prisma.e2e-spec.ts`

**Interfaces:**
- Consumes: `AppConfigService.databaseUrl` (Task 3).
- Produces:
  - `PrismaService extends PrismaClient` — injectable; connects `onModuleInit`, disconnects `onModuleDestroy`.
  - `PrismaModule` — global; exports `PrismaService`.
  - `startPostgres(): Promise<{ url: string; stop: () => Promise<void> }>` in `test/testcontainers.ts`.
  - Prisma `City` model: `id String @id @default(cuid())`, `slug String @unique`, `name String`, `timezone String`, `centerLat Float`, `centerLng Float`, `isActive Boolean @default(true)`, `createdAt DateTime @default(now())`.

- [ ] **Step 1: Add dependencies + prisma scripts**

Add to `apps/api/package.json` dependencies:

```json
"@prisma/client": "^5.20.0"
```

Add to devDependencies:

```json
"@testcontainers/postgresql": "^10.13.0",
"prisma": "^5.20.0",
"testcontainers": "^10.13.0"
```

Add to `apps/api/package.json` scripts:

```json
"prisma:generate": "prisma generate",
"prisma:migrate": "prisma migrate deploy",
"prisma:migrate:dev": "prisma migrate dev"
```

- [ ] **Step 2: Define the Prisma schema**

Create `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model City {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  timezone  String
  centerLat Float
  centerLng Float
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@map("cities")
}
```

- [ ] **Step 3: Create the initial migration + generate client**

Run against a local throwaway Postgres (Docker) to author the SQL migration file:

```bash
docker run --rm -d --name friends-pg-tmp -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=friends -p 55432:5432 postgres:16
export DATABASE_URL='postgresql://postgres:pg@localhost:55432/friends'
npm run prisma:migrate:dev -w @friends-ai/api -- --name init_city
npm run prisma:generate -w @friends-ai/api
docker stop friends-pg-tmp
```

Expected: `apps/api/prisma/migrations/<timestamp>_init_city/migration.sql` created; client generated. Commit the migration file.

- [ ] **Step 4: Write the shared Testcontainers helper**

Create `apps/api/test/testcontainers.ts`:

```ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

export interface StartedPostgres {
  url: string;
  stop: () => Promise<void>;
}

export async function startPostgres(): Promise<StartedPostgres> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16').start();
  const url = container.getConnectionUri();
  // Apply committed migrations to the fresh container.
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  return { url, stop: () => container.stop() };
}
```

- [ ] **Step 5: Write the failing integration test**

Create `apps/api/test/prisma.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { startPostgres, StartedPostgres } from './testcontainers';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Prisma (integration)', () => {
  let pg: StartedPostgres;
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    pg = await startPostgres();
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await pg?.stop();
  });

  it('round-trips a City row', async () => {
    const created = await prisma.city.create({
      data: { slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 57.6261, centerLng: 39.8845 },
    });
    const found = await prisma.city.findUnique({ where: { slug: 'yaroslavl' } });
    expect(found?.id).toBe(created.id);
    expect(found?.isActive).toBe(true);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npm run test:e2e -w @friends-ai/api -- prisma
```

Expected: FAIL — cannot find `../src/prisma/prisma.service` (Docker must be running for Testcontainers).

- [ ] **Step 7: Implement PrismaService + global module**

Create `apps/api/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ datasources: { db: { url: config.databaseUrl } } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Create `apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

- [ ] **Step 8: Wire PrismaModule into the app module**

Replace `apps/api/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [AppConfigModule, PrismaModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npm run test:e2e -w @friends-ai/api -- prisma
```

Expected: PASS (Testcontainers boots Postgres, migrations apply, City round-trips).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): Prisma integration, City model + migration, Testcontainers helper"
```

---

## Task 5: Redis integration + DB/Redis health checks

Adds a single `RedisService` (ioredis) and upgrades `/health` to a real Terminus check that reports Postgres and Redis liveness.

**Files:**
- Create: `apps/api/src/redis/redis.service.ts`
- Create: `apps/api/src/redis/redis.module.ts`
- Create: `apps/api/src/redis/redis.health.ts`
- Modify: `apps/api/src/health/health.module.ts` (import Terminus + Prisma/Redis indicators)
- Modify: `apps/api/src/health/health.controller.ts` (compose checks)
- Modify: `apps/api/src/app.module.ts` (import `RedisModule`)
- Modify: `apps/api/package.json` (add deps)
- Test: `apps/api/test/health.e2e-spec.ts` (extend), `apps/api/test/testcontainers.ts` (add `startRedis`)

**Interfaces:**
- Consumes: `AppConfigService.redisUrl` (Task 3), `PrismaService` (Task 4).
- Produces:
  - `RedisService` — injectable, wraps an `ioredis` client; method `ping(): Promise<'PONG'>`; exposes `client` getter; disconnects `onModuleDestroy`.
  - `RedisModule` — global; exports `RedisService`.
  - `RedisHealthIndicator.isHealthy(key: string): Promise<HealthIndicatorResult>`.
  - `startRedis(): Promise<{ url: string; stop: () => Promise<void> }>` in `test/testcontainers.ts`.
  - `GET /health` → `{ status: 'ok', info: { database: { status: 'up' }, redis: { status: 'up' } }, ... }` (Terminus shape).

- [ ] **Step 1: Add dependencies**

Add to `apps/api/package.json` dependencies:

```json
"@nestjs/terminus": "^10.2.3",
"ioredis": "^5.4.1"
```

Add to devDependencies:

```json
"@testcontainers/redis": "^10.13.0"
```

- [ ] **Step 2: Add the Redis Testcontainers helper**

Append to `apps/api/test/testcontainers.ts`:

```ts
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

export interface StartedRedis {
  url: string;
  stop: () => Promise<void>;
}

export async function startRedis(): Promise<StartedRedis> {
  const container: StartedRedisContainer = await new RedisContainer('redis:7').start();
  return { url: container.getConnectionUrl(), stop: () => container.stop() };
}
```

- [ ] **Step 3: Write the failing test (extend health e2e)**

Replace `apps/api/test/health.e2e-spec.ts` with:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startPostgres, startRedis, StartedPostgres, StartedRedis } from './testcontainers';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  }, 180000);

  afterAll(async () => {
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('GET /health reports database and redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
    expect(res.body.info.redis.status).toBe('up');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npm install
npm run test:e2e -w @friends-ai/api -- health
```

Expected: FAIL — `startRedis` undefined / `redis` indicator missing / health body has no `info`.

- [ ] **Step 5: Implement RedisService + global module**

Create `apps/api/src/redis/redis.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: AppConfigService) {
    this.client = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  }

  ping(): Promise<'PONG'> {
    return this.client.ping() as Promise<'PONG'>;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
```

Create `apps/api/src/redis/redis.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
```

- [ ] **Step 6: Implement the Redis health indicator**

Create `apps/api/src/redis/redis.health.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from './redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      return this.getStatus(key, pong === 'PONG');
    } catch (err) {
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { message: String(err) }));
    }
  }
}
```

- [ ] **Step 7: Compose the health check**

Replace `apps/api/src/health/health.controller.ts` with:

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisHealthIndicator } from '../redis/redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
```

Replace `apps/api/src/health/health.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from '../redis/redis.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
```

- [ ] **Step 8: Wire RedisModule into the app module**

Replace `apps/api/src/app.module.ts` with:

```ts
import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';

@Module({ imports: [AppConfigModule, PrismaModule, RedisModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
npm run test:e2e -w @friends-ai/api -- health
```

Expected: PASS — health reports `database.status=up` and `redis.status=up`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): Redis service + Terminus health check for database and redis"
```

---

## Task 6: Docker Compose + API Dockerfile + .env.example

Makes the whole stack reproducible: `docker compose up` brings up Postgres, Redis, MinIO, and the API, with `/health` green end-to-end.

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/api/Dockerfile`
- Create: `apps/api/.dockerignore`
- Create: `.env.example`
- Modify: `apps/api/package.json` (add `start:prod` that runs migrations then boots)

**Interfaces:**
- Consumes: the built API (Task 2–5), migrations (Task 4).
- Produces: a running compose stack; API reachable on host `:3000`, `GET /health` → 200.

- [ ] **Step 1: Document env keys**

Create `.env.example`:

```dotenv
# API
NODE_ENV=development
PORT=3000

# PostgreSQL
POSTGRES_USER=friends
POSTGRES_PASSWORD=changeme
POSTGRES_DB=friends
DATABASE_URL=postgresql://friends:changeme@postgres:5432/friends

# Redis
REDIS_URL=redis://redis:6379

# MinIO (S3-compatible object storage)
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=changeme123
S3_ENDPOINT=http://minio:9000
S3_BUCKET=friends-media
```

- [ ] **Step 2: Add a production start script that migrates first**

Add to `apps/api/package.json` scripts:

```json
"start:prod": "prisma migrate deploy && node dist/main.js"
```

- [ ] **Step 3: Write the API Dockerfile**

Create `apps/api/.dockerignore`:

```
node_modules
dist
**/*.spec.ts
**/*.e2e-spec.ts
```

Create `apps/api/Dockerfile` (multi-stage, monorepo-aware; build context is the repo root):

```dockerfile
# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @friends-ai/contracts \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @friends-ai/api

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev
COPY --from=builder /repo/packages/contracts/dist packages/contracts/dist
COPY --from=builder /repo/apps/api/dist apps/api/dist
COPY --from=builder /repo/apps/api/prisma apps/api/prisma
COPY --from=builder /repo/node_modules/.prisma node_modules/.prisma
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

- [ ] **Step 4: Write docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7
    ports: ['6379:6379']
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports: ['9000:9000', '9001:9001']
    volumes: ['miniodata:/data']

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
    ports: ['3000:3000']
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 5: Verify the stack boots and health is green**

```bash
cp .env.example .env
docker compose up -d --build
# wait for the api to migrate + boot, then:
sleep 15 && curl -fsS http://localhost:3000/health | tee /dev/stderr | grep -q '"status":"ok"'
```

Expected: JSON with `"status":"ok"` and both `database`/`redis` up. Then:

```bash
docker compose down
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: docker compose stack (postgres/redis/minio/api), api Dockerfile, .env.example"
```

---

## Task 7: CI pipeline (GitHub Actions)

Runs lint, typecheck, unit + e2e tests (Testcontainers works on GitHub-hosted runners via the bundled Docker), and build on every push/PR.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `apps/api/.eslintrc.cjs`
- Modify: `apps/api/package.json` (add eslint devDeps)

**Interfaces:**
- Consumes: workspace scripts `build:contracts`, and per-workspace `lint`/`typecheck`/`test`/`test:e2e`.
- Produces: a green CI run.

- [ ] **Step 1: Add ESLint config + deps**

Create `apps/api/.eslintrc.cjs`:

```js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: { project: 'tsconfig.json', tsconfigRootDir: __dirname, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['plugin:@typescript-eslint/recommended'],
  root: true,
  env: { node: true, jest: true },
  ignorePatterns: ['dist', 'node_modules', '.eslintrc.cjs'],
};
```

Add to `apps/api/package.json` devDependencies:

```json
"@typescript-eslint/eslint-plugin": "^8.8.0",
"@typescript-eslint/parser": "^8.8.0",
"eslint": "^8.57.0"
```

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build:contracts
      - run: npx prisma generate --schema apps/api/prisma/schema.prisma
      - run: npm run lint --workspaces --if-present
      - run: npm run typecheck --workspaces --if-present
      - run: npm run test --workspaces --if-present
      - run: npm run test:e2e -w @friends-ai/api
      - run: npm run build -w @friends-ai/api
```

- [ ] **Step 3: Validate the workflow locally (syntax + steps)**

```bash
# YAML sanity:
npx --yes js-yaml .github/workflows/ci.yml >/dev/null && echo "yaml ok"
# Reproduce the CI steps locally (Docker must be running for e2e):
npm ci
npm run build:contracts
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run test --workspaces --if-present
npm run test:e2e -w @friends-ai/api
npm run build -w @friends-ai/api
```

Expected: every step exits 0.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "ci: lint, typecheck, unit + e2e (testcontainers), build on push/PR"
git push
```

Expected: the CI run on GitHub goes green.

---

## Self-Review

**1. Spec coverage (against the architecture spec):**
- Modular monolith / NestJS + TS → Tasks 2–5 (module-per-concern wiring). ✅
- PostgreSQL + Prisma, migrations → Task 4. ✅
- Redis (foundation for cache/rate-limit/WS-adapter later) → Task 5. ✅
- `/api/v1` prefix + LB `/health` → Task 2, upgraded Task 5. ✅
- Config validated at boot, secrets in env → Task 3, `.env.example` Task 6. ✅
- `packages/contracts` shared types → Task 1. ✅
- Testcontainers e2e → Tasks 4–5. ✅
- Docker Compose (postgres/redis/minio) → Task 6. ✅
- CI (lint→typecheck→test→build) → Task 7. ✅
- `City` model (multi-city axis) seeded as first migration → Task 4. ✅
- Reference SPA preserved → Task 1. ✅
- Deferred to later plans (correctly out of this plan's scope): auth/JWT/argon2/captcha, accounts/profiles, discovery/matching, chat/Socket.IO, venues, moderation/AdminJS, media presigned uploads, S3 wiring beyond the MinIO container, BullMQ, OpenAPI/Swagger. These are explicit follow-on plans (1–6).

**2. Placeholder scan:** No TBD/TODO; every code and command step is concrete. ✅

**3. Type consistency:**
- `AppConfigService` getters (`databaseUrl`, `redisUrl`) defined in Task 3 are the exact names consumed by `PrismaService` (Task 4) and `RedisService` (Task 5). ✅
- `startPostgres`/`startRedis` return `{ url, stop }`; consumed with those names in Tasks 4–5. ✅
- `RedisService.ping()` returns `Promise<'PONG'>`; used by `RedisHealthIndicator` (Task 5). ✅
- Health route excluded from prefix consistently in `main.ts` and both e2e setups. ✅

---

## Execution Handoff

*(Filled in by the handoff step after the plan is reviewed.)*
