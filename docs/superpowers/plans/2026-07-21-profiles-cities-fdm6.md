# FDM-6 — Профили и города: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ввести доменное ядро продукта — аккаунт (одиночка/пара), участники, интересы, цели (intents), привязку к городу, онбординг, CRUD профиля и presigned-загрузку фото.

**Architecture:** NestJS модульный монолит. Новые flat-модули `catalog`, `accounts`, `media` под `apps/api/src/`, вручную регистрируются в `app.module.ts`. Общие типы/enum — в `@friends-ai/contracts`. Prisma-модели + миграция + идемпотентный seed. Все ответы профиля идут через явный маппер (без утечки `User`/email).

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL), class-validator/class-transformer, Zod (env), Jest + Supertest + Testcontainers, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (MinIO-совместимо).

**Spec:** [docs/superpowers/specs/2026-07-21-profiles-cities-fdm6-design.md](../specs/2026-07-21-profiles-cities-fdm6-design.md)

## Global Constraints

- **Node:** >=20. NestJS `^10.4.0`. Prisma `^5.20.0`. TypeScript `^5.6.3`.
- **API-префикс:** глобальный `api/v1` (`main.ts`), кроме `health`. Все пути ниже указаны без префикса — фактический URL включает `/api/v1`.
- **Guards:** `JwtAuthGuard` + `RolesGuard` глобальны (APP_GUARD в `AuthModule`). Каждый маршрут защищён по умолчанию; `@Public()` снимает защиту. Личность — `@CurrentUser() user: AuthUser` (`{ id, role }`) из `apps/api/src/auth/decorators/current-user.decorator.ts`.
- **ValidationPipe** глобальный: `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` — каждый DTO должен объявлять ВСЕ допустимые поля, вложенные объекты требуют `@Type()` + `@ValidateNested()`.
- **Ошибки:** глобальный `PrismaExceptionFilter` (`P2002→409`, `P2025→404`). Бросать стандартные Nest-исключения (`BadRequestException`, `ConflictException`, `NotFoundException`).
- **Инфра `@Global()`:** `PrismaService`, `AppConfigService`, `RedisService`, `MailService` — инжектить напрямую, не переимпортировать.
- **Контракты собираются первыми:** после правок в `packages/contracts` выполнять `npm run build:contracts` из корня перед тайпчеком `apps/api`.
- **Enum-значения:** `AccountKind` (`single`/`couple`) и `Intent` (`walks`,`double-dates`,`hobby`,`travel`,`deep-talks`,`events`) УЖЕ в `packages/contracts/src/enums.ts` — не переопределять.
- **Коммиты:** префикс `[FDM-6]`; в конце тела коммита строка `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Один PR, финальный коммит несёт `Closes #6`.
- **Тесты:** unit — `apps/api/jest.config.ts` (`*.spec.ts` под `src/`); e2e — `apps/api/test/jest-e2e.config.ts` (`*.e2e-spec.ts`, Testcontainers, `--runInBand`). Contracts-тесты — `packages/contracts` (jest).

---

### Task 1: Контракты — enum и DTO профиля

**Files:**
- Create: `packages/contracts/src/profiles.ts`
- Create: `packages/contracts/src/profiles.spec.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `AccountKind`, `Intent` из `packages/contracts/src/enums.ts`.
- Produces (используют все последующие задачи):
  - `enum ProfileStatus { Active='active', Hidden='hidden', Banned='banned' }`
  - `const INTENT_LABELS: Record<Intent, string>`
  - `interface CityDto { id: string; slug: string; name: string; timezone: string }`
  - `interface InterestDto { slug: string; label: string }`
  - `interface AccountMemberDto { id: string; position: number; name: string; age: number; photoUrl: string | null }`
  - `interface MyAccountResponse { id: string; kind: AccountKind; city: CityDto; bio: string | null; status: ProfileStatus; members: AccountMemberDto[]; interests: InterestDto[]; intents: Intent[]; lastActiveAt: string }`
  - `interface PhotoUploadUrlResponse { uploadUrl: string; objectKey: string; publicUrl: string; expiresIn: number }`

- [ ] **Step 1: Написать падающий тест**

Create `packages/contracts/src/profiles.spec.ts`:

```ts
import { Intent } from './enums';
import { ProfileStatus, INTENT_LABELS } from './profiles';

describe('profiles contracts', () => {
  it('ProfileStatus has active/hidden/banned string values', () => {
    expect(ProfileStatus.Active).toBe('active');
    expect(ProfileStatus.Hidden).toBe('hidden');
    expect(ProfileStatus.Banned).toBe('banned');
  });

  it('INTENT_LABELS covers every Intent value with a non-empty label', () => {
    for (const value of Object.values(Intent)) {
      expect(INTENT_LABELS[value]).toBeTruthy();
    }
    expect(Object.keys(INTENT_LABELS).sort()).toEqual([...Object.values(Intent)].sort());
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `npm test -w @friends-ai/contracts`
Expected: FAIL — `Cannot find module './profiles'`.

- [ ] **Step 3: Реализовать контракты**

Create `packages/contracts/src/profiles.ts`:

```ts
import { AccountKind, Intent } from './enums';

export enum ProfileStatus {
  Active = 'active',
  Hidden = 'hidden',
  Banned = 'banned',
}

export const INTENT_LABELS: Record<Intent, string> = {
  [Intent.Walks]: 'Прогулки по городу',
  [Intent.DoubleDates]: 'Дабл-дейты',
  [Intent.Hobby]: 'Общее хобби',
  [Intent.Travel]: 'Совместные поездки',
  [Intent.DeepTalks]: 'Глубокие разговоры',
  [Intent.Events]: 'Вечеринки и события',
};

export interface CityDto {
  id: string;
  slug: string;
  name: string;
  timezone: string;
}

export interface InterestDto {
  slug: string;
  label: string;
}

export interface AccountMemberDto {
  id: string;
  position: number;
  name: string;
  age: number;
  photoUrl: string | null;
}

export interface MyAccountResponse {
  id: string;
  kind: AccountKind;
  city: CityDto;
  bio: string | null;
  status: ProfileStatus;
  members: AccountMemberDto[];
  interests: InterestDto[];
  intents: Intent[];
  lastActiveAt: string;
}

export interface PhotoUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresIn: number;
}
```

Modify `packages/contracts/src/index.ts` — добавить строку:

```ts
export * from './profiles';
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `npm test -w @friends-ai/contracts`
Expected: PASS.

- [ ] **Step 5: Собрать контракты**

Run: `npm run build:contracts`
Expected: билд без ошибок (`packages/contracts/dist/profiles.js` создан).

- [ ] **Step 6: Коммит**

```bash
git add packages/contracts/src/profiles.ts packages/contracts/src/profiles.spec.ts packages/contracts/src/index.ts
git commit -m "[FDM-6] contracts: profile enums & DTOs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Prisma — enum, модели, миграция (+ GIN)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_accounts_profiles/migration.sql` (генерирует Prisma; вручную дописать GIN)
- Create: `apps/api/test/accounts-model.e2e-spec.ts`

**Interfaces:**
- Consumes: существующие `City`, `User` модели.
- Produces: Prisma-модели `Account`, `AccountMember`, `Interest`, `AccountInterest`; enum `AccountKind`, `ProfileStatus`. Поле `Account.intents String[]`. Индексы: `@@index([cityId, status])`, `@@unique(ownerUserId)`, `@@unique([accountId, position])` на членах, GIN `accounts_intents_gin` на `intents`.

- [ ] **Step 1: Написать падающий e2e-тест модели**

Create `apps/api/test/accounts-model.e2e-spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { startPostgres, StartedPostgres } from './testcontainers';

describe('Accounts data model (e2e)', () => {
  let pg: StartedPostgres;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pg = await startPostgres();
    prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await prisma.$connect();
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.stop();
  });

  it('creates a couple account with 2 members, interests and intents', async () => {
    const user = await prisma.user.create({ data: {} });
    const city = await prisma.city.create({
      data: { slug: 'c1', name: 'City', timezone: 'Europe/Moscow', centerLat: 1, centerLng: 2 },
    });
    const interest = await prisma.interest.create({ data: { slug: 'coffee', label: 'Кофе' } });

    const account = await prisma.account.create({
      data: {
        ownerUserId: user.id,
        kind: 'couple',
        cityId: city.id,
        intents: ['walks', 'deep-talks'],
        members: { create: [{ position: 0, name: 'A', age: 30 }, { position: 1, name: 'B', age: 28 }] },
        interests: { create: [{ interestId: interest.id }] },
      },
      include: { members: true, interests: true },
    });

    expect(account.members).toHaveLength(2);
    expect(account.interests).toHaveLength(1);
    expect(account.intents).toEqual(['walks', 'deep-talks']);
  });

  it('enforces one account per user (unique ownerUserId)', async () => {
    const user = await prisma.user.create({ data: {} });
    const city = await prisma.city.create({
      data: { slug: 'c2', name: 'City2', timezone: 'Europe/Moscow', centerLat: 1, centerLng: 2 },
    });
    const base = { ownerUserId: user.id, kind: 'single' as const, cityId: city.id };
    await prisma.account.create({ data: { ...base, members: { create: [{ position: 0, name: 'A', age: 30 }] } } });
    await expect(
      prisma.account.create({ data: { ...base, members: { create: [{ position: 0, name: 'A', age: 30 }] } } }),
    ).rejects.toThrow();
  });

  it('has a GIN index on accounts.intents', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'accounts_intents_gin'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef.toLowerCase()).toContain('using gin');
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm run test:e2e -w @friends-ai/api -- accounts-model`
Expected: FAIL на этапе ts-jest type-check — `TS2339: Property 'account'/'interest' does not exist on type 'PrismaClient'` (Prisma-клиент ещё не перегенерирован — это произойдёт в Step 4). Рантайм-проверки таблиц/GIN (тесты 1–3) реально отрабатывают только на Step 6 после `prisma generate`.

- [ ] **Step 3: Добавить модели в схему**

Modify `apps/api/prisma/schema.prisma`:

1) Добавить enum (после существующих enum-блоков):

```prisma
enum AccountKind {
  single
  couple
}

enum ProfileStatus {
  active
  hidden
  banned
}
```

2) Добавить обратную связь в существующие модели:
- в `model City { ... }` добавить строку: `accounts  Account[]`
- в `model User { ... }` добавить строку: `account   Account?`

3) Добавить новые модели:

```prisma
model Account {
  id           String        @id @default(cuid())
  ownerUserId  String        @unique
  owner        User          @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  kind         AccountKind
  cityId       String
  city         City          @relation(fields: [cityId], references: [id])
  bio          String?
  status       ProfileStatus @default(active)
  intents      String[]
  lastActiveAt DateTime      @default(now())
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  members      AccountMember[]
  interests    AccountInterest[]

  @@index([cityId, status])
  @@map("accounts")
}

model AccountMember {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  position  Int
  name      String
  age       Int
  photoUrl  String?

  @@unique([accountId, position])
  @@map("account_members")
}

model Interest {
  id       String  @id @default(cuid())
  slug     String  @unique
  label    String
  isActive Boolean @default(true)
  accounts AccountInterest[]

  @@map("interests")
}

model AccountInterest {
  accountId  String
  interestId String
  account    Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  interest   Interest @relation(fields: [interestId], references: [id])

  @@id([accountId, interestId])
  @@map("account_interests")
}
```

- [ ] **Step 4: Сгенерировать миграцию против одноразового Postgres**

Поднять пустой Postgres в Docker (одноразовый) и сгенерировать миграцию + клиент:

Run:
```bash
docker run --rm -d --name fdm6-mig -e POSTGRES_PASSWORD=pw -e POSTGRES_USER=pw -e POSTGRES_DB=pw -p 55432:5432 postgres:16
sleep 4
cd apps/api
DATABASE_URL=postgresql://pw:pw@localhost:55432/pw npx prisma migrate dev --name accounts_profiles
DATABASE_URL=postgresql://pw:pw@localhost:55432/pw npx prisma generate
cd ../..
docker stop fdm6-mig
```
Expected: создан каталог `apps/api/prisma/migrations/<timestamp>_accounts_profiles/migration.sql`; клиент перегенерирован.

- [ ] **Step 5: Вручную дописать GIN-индекс в миграцию**

Открыть только что созданный `apps/api/prisma/migrations/<timestamp>_accounts_profiles/migration.sql` и в КОНЕЦ файла добавить:

```sql
-- Prisma не генерирует USING GIN для скалярного массива; добавлено вручную.
-- ВНИМАНИЕ: сохранять эту строку при будущих migrate diff.
CREATE INDEX "accounts_intents_gin" ON "accounts" USING GIN ("intents");
```

- [ ] **Step 6: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- accounts-model`
Expected: PASS (3 теста: создание couple-аккаунта, unique ownerUserId, GIN-индекс).

- [ ] **Step 7: Тайпчек**

Run: `npm run typecheck -w @friends-ai/api`
Expected: без ошибок.

- [ ] **Step 8: Коммит**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/accounts-model.e2e-spec.ts
git commit -m "[FDM-6] prisma: Account/AccountMember/Interest models + GIN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Механизм seed + справочные данные

**Files:**
- Create: `apps/api/prisma/seed.ts`
- Modify: `apps/api/package.json` (блок `prisma.seed` + скрипт `db:seed`)
- Modify: `apps/api/test/testcontainers.ts` (хелпер `seedTestDatabase`)
- Create: `apps/api/test/seed.e2e-spec.ts`

**Interfaces:**
- Produces: сид Ярославля (`slug: 'yaroslavl'`) и 20 интересов (idempotent upsert по `slug`); экспортируемый хелпер `seedTestDatabase(url: string): void` в `test/testcontainers.ts`.

- [ ] **Step 1: Написать падающий e2e-тест сида**

Create `apps/api/test/seed.e2e-spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { startPostgres, seedTestDatabase, StartedPostgres } from './testcontainers';

describe('Seed (e2e)', () => {
  let pg: StartedPostgres;
  let prisma: PrismaClient;

  beforeAll(async () => {
    pg = await startPostgres();
    prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await prisma.$connect();
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.stop();
  });

  it('seeds Yaroslavl and 20 interests, idempotently', async () => {
    seedTestDatabase(pg.url);
    seedTestDatabase(pg.url); // повторный прогон не должен падать/дублировать

    const city = await prisma.city.findUnique({ where: { slug: 'yaroslavl' } });
    expect(city?.name).toBe('Ярославль');

    const interests = await prisma.interest.findMany();
    expect(interests).toHaveLength(20);
    const coffee = interests.filter((i) => i.slug === 'coffee');
    expect(coffee).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm run test:e2e -w @friends-ai/api -- seed`
Expected: FAIL — `seedTestDatabase` не экспортируется из `testcontainers`.

- [ ] **Step 3: Написать seed-скрипт**

Create `apps/api/prisma/seed.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INTERESTS: Array<{ slug: string; label: string }> = [
  { slug: 'coffee', label: 'Кофе' },
  { slug: 'boardgames', label: 'Настолки' },
  { slug: 'running', label: 'Бег' },
  { slug: 'cinema', label: 'Кино' },
  { slug: 'hiking', label: 'Походы' },
  { slug: 'wine', label: 'Вино' },
  { slug: 'photography', label: 'Фотография' },
  { slug: 'books', label: 'Книги' },
  { slug: 'yoga', label: 'Йога' },
  { slug: 'cycling', label: 'Велосипед' },
  { slug: 'cooking', label: 'Готовка' },
  { slug: 'music', label: 'Музыка' },
  { slug: 'art', label: 'Искусство' },
  { slug: 'startups', label: 'Стартапы' },
  { slug: 'travel', label: 'Путешествия' },
  { slug: 'snowboard', label: 'Сноуборд' },
  { slug: 'theatre', label: 'Театр' },
  { slug: 'podcasts', label: 'Подкасты' },
  { slug: 'ceramics', label: 'Керамика' },
  { slug: 'climbing', label: 'Скалолазание' },
];

async function main(): Promise<void> {
  await prisma.city.upsert({
    where: { slug: 'yaroslavl' },
    update: { name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 57.6261, centerLng: 39.8845, isActive: true },
    create: { slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 57.6261, centerLng: 39.8845 },
  });

  for (const i of INTERESTS) {
    await prisma.interest.upsert({
      where: { slug: i.slug },
      update: { label: i.label, isActive: true },
      create: i,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
```

Modify `apps/api/package.json` — добавить скрипт в блок `scripts`:

```json
    "db:seed": "prisma db seed",
```

и добавить верхнеуровневый блок `prisma` (рядом с `scripts`/`dependencies`):

```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
```

- [ ] **Step 4: Добавить хелпер seed в testcontainers**

Modify `apps/api/test/testcontainers.ts` — добавить в конец файла:

```ts
/** Прогоняет `prisma db seed` против уже мигрированной тестовой БД. */
export function seedTestDatabase(url: string): void {
  execSync('npx prisma db seed', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
```

(`execSync` и `path` уже импортированы в этом файле.)

- [ ] **Step 5: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- seed`
Expected: PASS.

- [ ] **Step 6: Коммит**

```bash
git add apps/api/prisma/seed.ts apps/api/package.json apps/api/test/testcontainers.ts apps/api/test/seed.e2e-spec.ts
git commit -m "[FDM-6] prisma: idempotent seed (Yaroslavl + interests)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Модуль `catalog` — GET /cities, GET /interests

**Files:**
- Create: `apps/api/src/catalog/catalog.service.ts`
- Create: `apps/api/src/catalog/catalog.controller.ts`
- Create: `apps/api/src/catalog/catalog.module.ts`
- Create: `apps/api/src/catalog/catalog.service.spec.ts`
- Create: `apps/api/test/catalog.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts` (импорт `CatalogModule`)

**Interfaces:**
- Consumes: `PrismaService`; `CityDto`, `InterestDto` из контрактов.
- Produces: `CatalogService.listCities(): Promise<CityDto[]>`, `CatalogService.listInterests(): Promise<InterestDto[]>`; публичные маршруты `GET /cities`, `GET /interests`.

- [ ] **Step 1: Написать падающий unit-тест сервиса**

Create `apps/api/src/catalog/catalog.service.spec.ts`:

```ts
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('returns only active cities as CityDto', async () => {
    const prisma = {
      city: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow', centerLat: 1, centerLng: 2, isActive: true, createdAt: new Date() }]) },
      interest: { findMany: jest.fn() },
    } as any;
    const svc = new CatalogService(prisma);

    const cities = await svc.listCities();

    expect(prisma.city.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { name: 'asc' } });
    expect(cities).toEqual([{ id: 'c1', slug: 'yaroslavl', name: 'Ярославль', timezone: 'Europe/Moscow' }]);
  });

  it('returns only active interests as InterestDto', async () => {
    const prisma = {
      city: { findMany: jest.fn() },
      interest: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', slug: 'coffee', label: 'Кофе', isActive: true }]) },
    } as any;
    const svc = new CatalogService(prisma);

    const interests = await svc.listInterests();

    expect(prisma.interest.findMany).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { label: 'asc' } });
    expect(interests).toEqual([{ slug: 'coffee', label: 'Кофе' }]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -w @friends-ai/api -- catalog.service`
Expected: FAIL — `Cannot find module './catalog.service'`.

- [ ] **Step 3: Реализовать сервис, контроллер, модуль**

Create `apps/api/src/catalog/catalog.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { CityDto, InterestDto } from '@friends-ai/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCities(): Promise<CityDto[]> {
    const cities = await this.prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return cities.map((c) => ({ id: c.id, slug: c.slug, name: c.name, timezone: c.timezone }));
  }

  async listInterests(): Promise<InterestDto[]> {
    const interests = await this.prisma.interest.findMany({ where: { isActive: true }, orderBy: { label: 'asc' } });
    return interests.map((i) => ({ slug: i.slug, label: i.label }));
  }
}
```

Create `apps/api/src/catalog/catalog.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { CityDto, InterestDto } from '@friends-ai/contracts';
import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('cities')
  cities(): Promise<CityDto[]> {
    return this.catalog.listCities();
  }

  @Get('interests')
  interests(): Promise<InterestDto[]> {
    return this.catalog.listInterests();
  }
}
```

Create `apps/api/src/catalog/catalog.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
```

Modify `apps/api/src/app.module.ts` — импортировать и добавить `CatalogModule` в массив `imports`:

```ts
import { CatalogModule } from './catalog/catalog.module';
```
(и добавить `CatalogModule,` в `imports`, рядом с `AuthModule`).

- [ ] **Step 4: Запустить unit — убедиться, что проходит**

Run: `npm test -w @friends-ai/api -- catalog.service`
Expected: PASS.

- [ ] **Step 5: Написать e2e**

Create `apps/api/test/catalog.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { startPostgres, startRedis, seedTestDatabase, StartedPostgres, StartedRedis } from './testcontainers';

describe('Catalog (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    seedTestDatabase(pg.url);
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.APP_URL = 'http://localhost:5173';
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  }, 180000);

  afterAll(async () => {
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('GET /cities returns seeded Yaroslavl (public, no auth)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/cities').expect(200);
    expect(res.body.some((c: any) => c.slug === 'yaroslavl')).toBe(true);
    expect(res.body[0]).not.toHaveProperty('centerLat');
  });

  it('GET /interests returns 20 seeded interests (public)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/interests').expect(200);
    expect(res.body).toHaveLength(20);
    expect(res.body[0]).toEqual(expect.objectContaining({ slug: expect.any(String), label: expect.any(String) }));
  });
});
```

- [ ] **Step 6: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- catalog`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add apps/api/src/catalog apps/api/src/app.module.ts apps/api/test/catalog.e2e-spec.ts
git commit -m "[FDM-6] catalog: public cities & interests endpoints

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Accounts — онбординг (POST /accounts) + GET /accounts/me

**Files:**
- Create: `apps/api/src/accounts/dto/member-input.dto.ts`
- Create: `apps/api/src/accounts/dto/create-account.dto.ts`
- Create: `apps/api/src/accounts/accounts.mapper.ts`
- Create: `apps/api/src/accounts/accounts.service.ts`
- Create: `apps/api/src/accounts/accounts.controller.ts`
- Create: `apps/api/src/accounts/accounts.module.ts`
- Create: `apps/api/src/accounts/accounts.service.spec.ts`
- Create: `apps/api/src/accounts/dto/create-account.dto.spec.ts`
- Create: `apps/api/test/accounts.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts` (импорт `AccountsModule`)

**Interfaces:**
- Consumes: `PrismaService`; `AuthUser`, `TokenService` (в e2e); `AccountKind`, `Intent`, `MyAccountResponse` из контрактов.
- Produces:
  - `MemberInputDto { name: string; age: number }`
  - `CreateAccountDto { kind: AccountKind; cityId: string; bio?: string; members: MemberInputDto[]; interestSlugs: string[]; intents: Intent[] }`
  - `ACCOUNT_INCLUDE` (Prisma include) + `toMyAccountResponse(account): MyAccountResponse` в `accounts.mapper.ts`
  - `AccountsService.createAccount(userId, dto): Promise<MyAccountResponse>`
  - `AccountsService.getMyAccount(userId): Promise<MyAccountResponse>`
  - Хелперы (используются задачами 6–8): `AccountsService.requireOwnAccount(userId)`, `AccountsService.resolveInterestIds(slugs, tx?)`, `AccountsService.assertMemberCardinality(kind, count)`
  - Маршруты `POST /accounts` (201), `GET /accounts/me` (200)

- [ ] **Step 1: Написать падающий unit-тест сервиса**

Create `apps/api/src/accounts/accounts.service.spec.ts`:

```ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountKind, Intent } from '@friends-ai/contracts';
import { AccountsService } from './accounts.service';

// Единая фабрика сервиса для всех describe-блоков этого файла (Tasks 5–8).
// Task 9 меняет ТОЛЬКО эту строку (добавляет конфиг-стаб вторым аргументом).
const newService = (prisma: any) => new AccountsService(prisma);

function makeDto(overrides: Partial<any> = {}) {
  return {
    kind: AccountKind.Single,
    cityId: 'city1',
    bio: 'hi',
    members: [{ name: 'A', age: 30 }],
    interestSlugs: ['coffee', 'books'],
    intents: [Intent.Walks],
    ...overrides,
  };
}

describe('AccountsService.createAccount', () => {
  it('rejects a second account for the same user', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.createAccount('u1', makeDto())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects couple with only one member', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const svc = newService(prisma);
    await expect(
      svc.createAccount('u1', makeDto({ kind: AccountKind.Couple, members: [{ name: 'A', age: 30 }] })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive/unknown city', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
      city: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.createAccount('u1', makeDto())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown interest slugs', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
      city: { findFirst: jest.fn().mockResolvedValue({ id: 'city1', isActive: true }) },
      interest: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', slug: 'coffee' }]) }, // only 1 of 2
    } as any;
    const svc = newService(prisma);
    await expect(svc.createAccount('u1', makeDto())).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

Create `apps/api/src/accounts/dto/create-account.dto.spec.ts` (unit на правила валидации DTO — spec §8 «Unit: валидация DTO»):

```ts
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AccountKind, Intent } from '@friends-ai/contracts';
import { CreateAccountDto } from './create-account.dto';

function errorsFor(payload: unknown) {
  return validateSync(plainToInstance(CreateAccountDto, payload), { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateAccountDto validation', () => {
  const valid = {
    kind: AccountKind.Single,
    cityId: 'city1',
    members: [{ name: 'A', age: 30 }],
    interestSlugs: ['coffee', 'books'],
    intents: [Intent.Walks],
  };

  it('accepts a valid single payload', () => {
    expect(errorsFor(valid)).toHaveLength(0);
  });

  it('rejects fewer than 2 interest slugs', () => {
    expect(errorsFor({ ...valid, interestSlugs: ['coffee'] }).length).toBeGreaterThan(0);
  });

  it('rejects age outside 18-99', () => {
    expect(errorsFor({ ...valid, members: [{ name: 'A', age: 15 }] }).length).toBeGreaterThan(0);
  });

  it('rejects an empty members array', () => {
    expect(errorsFor({ ...valid, members: [] }).length).toBeGreaterThan(0);
  });

  it('rejects an unknown enum intent', () => {
    expect(errorsFor({ ...valid, intents: ['skydiving'] }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -w @friends-ai/api -- "accounts.service|create-account.dto"`
Expected: FAIL — `Cannot find module './accounts.service'` / `'./create-account.dto'` (модули ещё не созданы).

- [ ] **Step 3: Реализовать DTO, маппер, сервис, контроллер, модуль**

Create `apps/api/src/accounts/dto/member-input.dto.ts`:

```ts
import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class MemberInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsInt()
  @Min(18)
  @Max(99)
  age!: number;
}
```

Create `apps/api/src/accounts/dto/create-account.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { AccountKind, Intent } from '@friends-ai/contracts';
import { MemberInputDto } from './member-input.dto';

export class CreateAccountDto {
  @IsEnum(AccountKind)
  kind!: AccountKind;

  @IsString()
  @IsNotEmpty()
  cityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => MemberInputDto)
  members!: MemberInputDto[];

  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsString({ each: true })
  interestSlugs!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Intent, { each: true })
  intents!: Intent[];
}
```
Create `apps/api/src/accounts/accounts.mapper.ts`:

```ts
import { Prisma } from '@prisma/client';
import { AccountKind, Intent, MyAccountResponse, ProfileStatus } from '@friends-ai/contracts';

export const ACCOUNT_INCLUDE = {
  city: true,
  members: { orderBy: { position: 'asc' } },
  interests: { include: { interest: true } },
} satisfies Prisma.AccountInclude;

type AccountWithRelations = Prisma.AccountGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

export function toMyAccountResponse(account: AccountWithRelations): MyAccountResponse {
  return {
    id: account.id,
    kind: account.kind as AccountKind,
    city: { id: account.city.id, slug: account.city.slug, name: account.city.name, timezone: account.city.timezone },
    bio: account.bio,
    status: account.status as ProfileStatus,
    members: account.members.map((m) => ({ id: m.id, position: m.position, name: m.name, age: m.age, photoUrl: m.photoUrl })),
    interests: account.interests.map((ai) => ({ slug: ai.interest.slug, label: ai.interest.label })),
    intents: account.intents as Intent[],
    lastActiveAt: account.lastActiveAt.toISOString(),
  };
}
```

Create `apps/api/src/accounts/accounts.service.ts`:

```ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountKind, MyAccountResponse } from '@friends-ai/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ACCOUNT_INCLUDE, toMyAccountResponse } from './accounts.mapper';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAccount(userId: string, dto: CreateAccountDto): Promise<MyAccountResponse> {
    const existing = await this.prisma.account.findUnique({ where: { ownerUserId: userId } });
    if (existing) throw new ConflictException('Account already exists');

    this.assertMemberCardinality(dto.kind, dto.members.length);

    const city = await this.prisma.city.findFirst({ where: { id: dto.cityId, isActive: true } });
    if (!city) throw new BadRequestException('Unknown or inactive city');

    const interestIds = await this.resolveInterestIds(dto.interestSlugs);

    const account = await this.prisma.account.create({
      data: {
        ownerUserId: userId,
        kind: dto.kind,
        cityId: dto.cityId,
        bio: dto.bio ?? null,
        intents: dto.intents,
        members: { create: dto.members.map((m, i) => ({ position: i, name: m.name, age: m.age })) },
        interests: { create: interestIds.map((interestId) => ({ interestId })) },
      },
      include: ACCOUNT_INCLUDE,
    });
    return toMyAccountResponse(account);
  }

  async getMyAccount(userId: string): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);
    return toMyAccountResponse(account);
  }

  async requireOwnAccount(userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { ownerUserId: userId },
      include: ACCOUNT_INCLUDE,
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  assertMemberCardinality(kind: AccountKind, count: number): void {
    const expected = kind === AccountKind.Couple ? 2 : 1;
    if (count !== expected) {
      throw new BadRequestException(`${kind} account must have exactly ${expected} member(s)`);
    }
  }

  async resolveInterestIds(slugs: string[], tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<string[]> {
    const unique = [...new Set(slugs)];
    const interests = await tx.interest.findMany({ where: { slug: { in: unique }, isActive: true } });
    if (interests.length !== unique.length) throw new BadRequestException('Unknown or inactive interests');
    return interests.map((i) => i.id);
  }
}
```

Create `apps/api/src/accounts/accounts.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MyAccountResponse } from '@friends-ai/contracts';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAccountDto): Promise<MyAccountResponse> {
    return this.accounts.createAccount(user.id, dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MyAccountResponse> {
    return this.accounts.getMyAccount(user.id);
  }
}
```

Create `apps/api/src/accounts/accounts.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
```

Modify `apps/api/src/app.module.ts` — импортировать и добавить `AccountsModule` в `imports`:

```ts
import { AccountsModule } from './accounts/accounts.module';
```

- [ ] **Step 4: Запустить unit — убедиться, что проходит**

Run: `npm test -w @friends-ai/api -- "accounts.service|create-account.dto"`
Expected: PASS (unit сервиса + валидация `CreateAccountDto`).

- [ ] **Step 5: Написать e2e (онбординг + приватность)**

Create `apps/api/test/accounts.e2e-spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import { Role, AccountKind, Intent } from '@friends-ai/contracts';
import { startPostgres, startRedis, seedTestDatabase, StartedPostgres, StartedRedis } from './testcontainers';
import { TokenService } from '../src/auth/token.service';

describe('Accounts onboarding (e2e)', () => {
  let pg: StartedPostgres;
  let redis: StartedRedis;
  let app: INestApplication;
  let prisma: PrismaClient;
  let cityId: string;

  async function newUserToken(): Promise<string> {
    const user = await prisma.user.create({ data: {} });
    return app.get(TokenService).signAccess(user.id, Role.User);
  }

  beforeAll(async () => {
    pg = await startPostgres();
    redis = await startRedis();
    seedTestDatabase(pg.url);
    process.env.DATABASE_URL = pg.url;
    process.env.REDIS_URL = redis.url;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'x'.repeat(32);
    process.env.APP_URL = 'http://localhost:5173';
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = new PrismaClient({ datasources: { db: { url: pg.url } } });
    await prisma.$connect();
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: 'yaroslavl' } });
    cityId = city.id;
  }, 180000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
    await redis?.stop();
    await pg?.stop();
  });

  it('creates a single account and returns it via /accounts/me without leaking user id', async () => {
    const token = await newUserToken();
    const payload = {
      kind: AccountKind.Single,
      cityId,
      bio: 'Люблю кофе',
      members: [{ name: 'Аня', age: 27 }],
      interestSlugs: ['coffee', 'books'],
      intents: [Intent.Walks],
    };
    const created = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    expect(created.body.kind).toBe('single');
    expect(created.body.members).toHaveLength(1);
    expect(created.body).not.toHaveProperty('ownerUserId');

    const me = await request(app.getHttpServer())
      .get('/api/v1/accounts/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.city.slug).toBe('yaroslavl');
    expect(me.body.interests.map((i: any) => i.slug).sort()).toEqual(['books', 'coffee']);
    expect(JSON.stringify(me.body)).not.toContain('ownerUserId');
  });

  it('rejects a second account for the same user with 409', async () => {
    const token = await newUserToken();
    const payload = {
      kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }],
      interestSlugs: ['coffee', 'books'], intents: [Intent.Walks],
    };
    await request(app.getHttpServer()).post('/api/v1/accounts').set('Authorization', `Bearer ${token}`).send(payload).expect(201);
    await request(app.getHttpServer()).post('/api/v1/accounts').set('Authorization', `Bearer ${token}`).send(payload).expect(409);
  });

  it('rejects unauthenticated onboarding with 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/accounts').send({}).expect(401);
  });

  it('rejects couple with one member (400)', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Couple, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(400);
  });
});
```

- [ ] **Step 6: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- accounts.e2e`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add apps/api/src/accounts apps/api/src/app.module.ts apps/api/test/accounts.e2e-spec.ts
git commit -m "[FDM-6] accounts: onboarding + GET /accounts/me

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Accounts — редактирование профиля (PATCH /accounts/me)

**Files:**
- Create: `apps/api/src/accounts/dto/update-account.dto.ts`
- Modify: `apps/api/src/accounts/accounts.service.ts` (метод `updateProfile`)
- Modify: `apps/api/src/accounts/accounts.controller.ts` (маршрут `PATCH me`)
- Modify: `apps/api/src/accounts/accounts.service.spec.ts` (тест `updateProfile`)
- Modify: `apps/api/test/accounts.e2e-spec.ts` (e2e-кейс правки)

**Interfaces:**
- Consumes: `requireOwnAccount`, `resolveInterestIds` из Task 5.
- Produces: `UpdateAccountDto { bio?: string; interestSlugs?: string[]; intents?: Intent[] }`; `AccountsService.updateProfile(userId, dto): Promise<MyAccountResponse>`; маршрут `PATCH /accounts/me`.

- [ ] **Step 1: Написать падающий unit-тест**

Append to `apps/api/src/accounts/accounts.service.spec.ts`:

```ts
describe('AccountsService.updateProfile', () => {
  it('resets interests inside a transaction and updates bio', async () => {
    const tx = {
      interest: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', slug: 'coffee' }, { id: 'i2', slug: 'wine' }]) },
      accountInterest: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
      account: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'a1' }) // requireOwnAccount (первый вызов)
          .mockResolvedValueOnce({ id: 'a1', city: { id: 'c', slug: 's', name: 'n', timezone: 't' }, members: [], interests: [], intents: [], bio: 'new', status: 'active', kind: 'single', lastActiveAt: new Date() }), // финальный getMyAccount
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    } as any;
    const svc = newService(prisma);

    await svc.updateProfile('u1', { bio: 'new', interestSlugs: ['coffee', 'wine'] });

    expect(tx.accountInterest.deleteMany).toHaveBeenCalledWith({ where: { accountId: 'a1' } });
    expect(tx.accountInterest.createMany).toHaveBeenCalledWith({ data: [{ accountId: 'a1', interestId: 'i1' }, { accountId: 'a1', interestId: 'i2' }] });
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { bio: 'new' } });
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -w @friends-ai/api -- accounts.service`
Expected: FAIL — `updateProfile` не существует.

- [ ] **Step 3: Реализовать DTO и метод**

Create `apps/api/src/accounts/dto/update-account.dto.ts`:

```ts
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Intent } from '@friends-ai/contracts';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsString({ each: true })
  interestSlugs?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(Intent, { each: true })
  intents?: Intent[];
}
```

Modify `apps/api/src/accounts/accounts.service.ts` — добавить метод (и импорт `UpdateAccountDto`):

```ts
  async updateProfile(userId: string, dto: UpdateAccountDto): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.interestSlugs !== undefined) {
        const ids = await this.resolveInterestIds(dto.interestSlugs, tx);
        await tx.accountInterest.deleteMany({ where: { accountId: account.id } });
        await tx.accountInterest.createMany({ data: ids.map((interestId) => ({ accountId: account.id, interestId })) });
      }
      const data: Prisma.AccountUpdateInput = {};
      if (dto.bio !== undefined) data.bio = dto.bio;
      if (dto.intents !== undefined) data.intents = dto.intents;
      if (Object.keys(data).length > 0) await tx.account.update({ where: { id: account.id }, data });
    });

    return this.getMyAccount(userId);
  }
```

Modify `apps/api/src/accounts/accounts.controller.ts` — добавить маршрут (и импорты `Patch`, `UpdateAccountDto`):

```ts
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateAccountDto): Promise<MyAccountResponse> {
    return this.accounts.updateProfile(user.id, dto);
  }
```

- [ ] **Step 4: Запустить unit — убедиться, что проходит**

Run: `npm test -w @friends-ai/api -- accounts.service`
Expected: PASS.

- [ ] **Step 5: Добавить e2e-кейс правки**

Append a test inside `apps/api/test/accounts.e2e-spec.ts` (в том же `describe`):

```ts
  it('edits bio, interests and intents via PATCH /accounts/me', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/accounts/me').set('Authorization', `Bearer ${token}`)
      .send({ bio: 'обновил', interestSlugs: ['wine', 'yoga'], intents: [Intent.Travel, Intent.Hobby] })
      .expect(200);

    expect(res.body.bio).toBe('обновил');
    expect(res.body.interests.map((i: any) => i.slug).sort()).toEqual(['wine', 'yoga']);
    expect(res.body.intents.sort()).toEqual(['hobby', 'travel']);
  });
```

- [ ] **Step 6: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- accounts.e2e`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add apps/api/src/accounts apps/api/test/accounts.e2e-spec.ts
git commit -m "[FDM-6] accounts: PATCH /accounts/me (bio/interests/intents)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Accounts — смена kind (PATCH /accounts/me/kind)

**Files:**
- Create: `apps/api/src/accounts/dto/change-kind.dto.ts`
- Modify: `apps/api/src/accounts/accounts.service.ts` (метод `changeKind`)
- Modify: `apps/api/src/accounts/accounts.controller.ts` (маршрут `PATCH me/kind`)
- Modify: `apps/api/src/accounts/accounts.service.spec.ts`
- Modify: `apps/api/test/accounts.e2e-spec.ts`

**Interfaces:**
- Consumes: `requireOwnAccount` из Task 5.
- Produces: `ChangeKindDto { kind: AccountKind; secondMember?: MemberInputDto }`; `AccountsService.changeKind(userId, dto): Promise<MyAccountResponse>`; маршрут `PATCH /accounts/me/kind`.

- [ ] **Step 1: Написать падающий unit-тест**

Append to `apps/api/src/accounts/accounts.service.spec.ts`:

```ts
describe('AccountsService.changeKind', () => {
  it('single -> couple requires secondMember and inserts member at position 1', async () => {
    const tx = {
      accountMember: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
      account: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'a1', kind: 'single', members: [{ id: 'm0', position: 0 }] })
          .mockResolvedValueOnce({ id: 'a1', kind: 'couple', city: { id: 'c', slug: 's', name: 'n', timezone: 't' }, members: [], interests: [], intents: [], bio: null, status: 'active', lastActiveAt: new Date() }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    } as any;
    const svc = newService(prisma);

    await svc.changeKind('u1', { kind: AccountKind.Couple, secondMember: { name: 'B', age: 29 } });

    expect(tx.accountMember.create).toHaveBeenCalledWith({ data: { accountId: 'a1', position: 1, name: 'B', age: 29 } });
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { kind: AccountKind.Couple } });
  });

  it('single -> couple without secondMember throws BadRequest', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', kind: 'single', members: [{ id: 'm0', position: 0 }] }) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb({})),
    } as any;
    const svc = newService(prisma);
    await expect(svc.changeKind('u1', { kind: AccountKind.Couple })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects no-op change to the same kind', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', kind: 'single', members: [] }) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.changeKind('u1', { kind: AccountKind.Single })).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -w @friends-ai/api -- accounts.service`
Expected: FAIL — `changeKind` не существует.

- [ ] **Step 3: Реализовать DTO и метод**

Create `apps/api/src/accounts/dto/change-kind.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { AccountKind } from '@friends-ai/contracts';
import { MemberInputDto } from './member-input.dto';

export class ChangeKindDto {
  @IsEnum(AccountKind)
  kind!: AccountKind;

  @IsOptional()
  @ValidateNested()
  @Type(() => MemberInputDto)
  secondMember?: MemberInputDto;
}
```

Modify `apps/api/src/accounts/accounts.service.ts` — добавить метод (импорт `ChangeKindDto`):

```ts
  async changeKind(userId: string, dto: ChangeKindDto): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);
    if (account.kind === dto.kind) throw new BadRequestException(`Account is already ${dto.kind}`);

    await this.prisma.$transaction(async (tx) => {
      if (dto.kind === AccountKind.Couple) {
        if (!dto.secondMember) throw new BadRequestException('secondMember is required to switch to couple');
        await tx.accountMember.create({
          data: { accountId: account.id, position: 1, name: dto.secondMember.name, age: dto.secondMember.age },
        });
      } else {
        await tx.accountMember.deleteMany({ where: { accountId: account.id, position: { gte: 1 } } });
      }
      await tx.account.update({ where: { id: account.id }, data: { kind: dto.kind } });
    });

    return this.getMyAccount(userId);
  }
```

Modify `apps/api/src/accounts/accounts.controller.ts` — добавить маршрут (импорт `ChangeKindDto`):

```ts
  @Patch('me/kind')
  changeKind(@CurrentUser() user: AuthUser, @Body() dto: ChangeKindDto): Promise<MyAccountResponse> {
    return this.accounts.changeKind(user.id, dto);
  }
```

- [ ] **Step 4: Запустить unit — убедиться, что проходит**

Run: `npm test -w @friends-ai/api -- accounts.service`
Expected: PASS.

- [ ] **Step 5: Добавить e2e-кейс смены kind**

Append inside `apps/api/test/accounts.e2e-spec.ts`:

```ts
  it('switches single -> couple then couple -> single, keeping member cardinality consistent', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);

    const toCouple = await request(app.getHttpServer())
      .patch('/api/v1/accounts/me/kind').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Couple, secondMember: { name: 'B', age: 28 } })
      .expect(200);
    expect(toCouple.body.kind).toBe('couple');
    expect(toCouple.body.members).toHaveLength(2);
    expect(toCouple.body.members.map((m: any) => m.position)).toEqual([0, 1]);

    const toSingle = await request(app.getHttpServer())
      .patch('/api/v1/accounts/me/kind').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single })
      .expect(200);
    expect(toSingle.body.kind).toBe('single');
    expect(toSingle.body.members).toHaveLength(1);
  });
```

- [ ] **Step 6: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- accounts.e2e`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add apps/api/src/accounts apps/api/test/accounts.e2e-spec.ts
git commit -m "[FDM-6] accounts: PATCH /accounts/me/kind (single<->couple)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Accounts — правка участника (PATCH /accounts/me/members/:id)

**Files:**
- Create: `apps/api/src/accounts/dto/update-member.dto.ts`
- Modify: `apps/api/src/accounts/accounts.service.ts` (метод `updateMember`)
- Modify: `apps/api/src/accounts/accounts.controller.ts` (маршрут)
- Modify: `apps/api/src/accounts/accounts.service.spec.ts`
- Modify: `apps/api/test/accounts.e2e-spec.ts`

**Interfaces:**
- Consumes: `requireOwnAccount` из Task 5.
- Produces: `UpdateMemberDto { name?: string; age?: number }` (поле `photoObjectKey?` добавит Task 9); `AccountsService.updateMember(userId, memberId, dto): Promise<MyAccountResponse>`; маршрут `PATCH /accounts/me/members/:id`.

- [ ] **Step 1: Написать падающий unit-тест**

Append to `apps/api/src/accounts/accounts.service.spec.ts`:

```ts
// (NotFoundException уже импортирован в шапке файла — Task 5)
describe('AccountsService.updateMember', () => {
  it('updates name/age of an owned member', async () => {
    const prisma = {
      account: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'a1', members: [{ id: 'm0', position: 0 }] })
          .mockResolvedValueOnce({ id: 'a1', kind: 'single', city: { id: 'c', slug: 's', name: 'n', timezone: 't' }, members: [], interests: [], intents: [], bio: null, status: 'active', lastActiveAt: new Date() }),
      },
      accountMember: { update: jest.fn().mockResolvedValue({}) },
    } as any;
    const svc = newService(prisma);

    await svc.updateMember('u1', 'm0', { name: 'New', age: 31 });

    expect(prisma.accountMember.update).toHaveBeenCalledWith({ where: { id: 'm0' }, data: { name: 'New', age: 31 } });
  });

  it('throws NotFound for a member not on the user account', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', members: [{ id: 'm0', position: 0 }] }) },
    } as any;
    const svc = newService(prisma);
    await expect(svc.updateMember('u1', 'other', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `npm test -w @friends-ai/api -- accounts.service`
Expected: FAIL — `updateMember` не существует.

- [ ] **Step 3: Реализовать DTO и метод**

Create `apps/api/src/accounts/dto/update-member.dto.ts`:

```ts
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(99)
  age?: number;
}
```

Modify `apps/api/src/accounts/accounts.service.ts` — добавить метод (импорт `UpdateMemberDto`; `NotFoundException` уже импортирован):

```ts
  async updateMember(userId: string, memberId: string, dto: UpdateMemberDto): Promise<MyAccountResponse> {
    const account = await this.requireOwnAccount(userId);
    const member = account.members.find((m) => m.id === memberId);
    if (!member) throw new NotFoundException('Member not found');

    const data: Prisma.AccountMemberUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.age !== undefined) data.age = dto.age;
    if (Object.keys(data).length > 0) await this.prisma.accountMember.update({ where: { id: memberId }, data });

    return this.getMyAccount(userId);
  }
```

Modify `apps/api/src/accounts/accounts.controller.ts` — добавить маршрут (импорт `Param`, `UpdateMemberDto`):

```ts
  @Patch('me/members/:id')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MyAccountResponse> {
    return this.accounts.updateMember(user.id, memberId, dto);
  }
```

- [ ] **Step 4: Запустить unit — убедиться, что проходит**

Run: `npm test -w @friends-ai/api -- accounts.service`
Expected: PASS.

- [ ] **Step 5: Добавить e2e-кейс**

Append inside `apps/api/test/accounts.e2e-spec.ts`:

```ts
  it('edits a member name/age via PATCH /accounts/me/members/:id', async () => {
    const token = await newUserToken();
    const created = await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);
    const memberId = created.body.members[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/me/members/${memberId}`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Аня', age: 28 })
      .expect(200);
    expect(res.body.members[0]).toEqual(expect.objectContaining({ name: 'Аня', age: 28 }));
  });
```

- [ ] **Step 6: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- accounts.e2e`
Expected: PASS.

- [ ] **Step 7: Коммит**

```bash
git add apps/api/src/accounts apps/api/test/accounts.e2e-spec.ts
git commit -m "[FDM-6] accounts: PATCH member name/age

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Media — S3-конфиг + presigned-загрузка + привязка фото

**Files:**
- Modify: `apps/api/package.json` (deps `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- Modify: `apps/api/src/config/env.schema.ts` (S3-переменные с dev-дефолтами)
- Modify: `apps/api/src/config/config.service.ts` (геттеры S3)
- Modify: `apps/api/src/config/env.schema.spec.ts` (дефолты S3)
- Modify: `.env.example` (S3-ключи)
- Create: `apps/api/src/media/dto/create-photo-upload-url.dto.ts`
- Create: `apps/api/src/media/media.service.ts`
- Create: `apps/api/src/media/media.controller.ts`
- Create: `apps/api/src/media/media.module.ts`
- Create: `apps/api/src/media/media.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (импорт `MediaModule`)
- Modify: `apps/api/src/accounts/dto/update-member.dto.ts` (`photoObjectKey?`)
- Modify: `apps/api/src/accounts/accounts.service.ts` (привязка фото в `updateMember` + инъекция `AppConfigService`)
- Modify: `apps/api/test/accounts.e2e-spec.ts` (e2e presign + attach)

**Interfaces:**
- Consumes: `AppConfigService`, `PrismaService`, `AuthUser`; `PhotoUploadUrlResponse` из контрактов.
- Produces:
  - env: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`, `S3_UPLOAD_MAX_BYTES`; геттеры `s3Endpoint/s3Region/s3Bucket/s3AccessKey/s3SecretKey/s3PublicUrl/s3UploadMaxBytes`.
  - `CreatePhotoUploadUrlDto { contentType: string; contentLength: number }`
  - `MediaService.createPhotoUploadUrl(userId, dto): Promise<PhotoUploadUrlResponse>`; маршрут `POST /media/photo-upload-url`.
  - `UpdateMemberDto.photoObjectKey?: string`; `updateMember` сохраняет `photoUrl = s3PublicUrl + '/' + objectKey` после проверки неймспейса.

- [ ] **Step 1: Установить AWS SDK**

Run: `npm install @aws-sdk/client-s3@^3 @aws-sdk/s3-request-presigner@^3 -w @friends-ai/api`
Expected: пакеты добавлены в `apps/api/package.json` (dependencies).

- [ ] **Step 2: Написать падающий unit-тест env + сервиса**

Append to `apps/api/src/config/env.schema.spec.ts` — новый describe-блок (НЕ добавляйте импорт: `validateEnv` уже импортирован в шапке файла):

```ts
describe('env S3 defaults', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'x'.repeat(32),
    APP_URL: 'http://localhost:5173',
  };
  it('applies dev S3 defaults so AppModule boots without S3 env', () => {
    const env = validateEnv({ ...base });
    expect(env.S3_BUCKET).toBe('friends-media');
    expect(env.S3_UPLOAD_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
```

Create `apps/api/src/media/media.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';

function makeConfig() {
  return {
    s3Endpoint: 'http://localhost:9000',
    s3Region: 'us-east-1',
    s3Bucket: 'friends-media',
    s3AccessKey: 'minio',
    s3SecretKey: 'changeme123',
    s3PublicUrl: 'http://localhost:9000/friends-media',
    s3UploadMaxBytes: 5 * 1024 * 1024,
  } as any;
}

describe('MediaService.createPhotoUploadUrl', () => {
  it('returns a presigned url + object key under the account namespace', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc1' }) } } as any;
    const svc = new MediaService(makeConfig(), prisma);

    const res = await svc.createPhotoUploadUrl('u1', { contentType: 'image/jpeg', contentLength: 1000 });

    expect(res.objectKey).toMatch(/^accounts\/acc1\/[a-f0-9-]+\.jpg$/);
    expect(res.uploadUrl).toContain('http');
    expect(res.publicUrl).toBe(`http://localhost:9000/friends-media/${res.objectKey}`);
    expect(res.expiresIn).toBeGreaterThan(0);
  });

  it('rejects unsupported content type', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc1' }) } } as any;
    const svc = new MediaService(makeConfig(), prisma);
    await expect(svc.createPhotoUploadUrl('u1', { contentType: 'application/pdf', contentLength: 10 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversize files', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue({ id: 'acc1' }) } } as any;
    const svc = new MediaService(makeConfig(), prisma);
    await expect(svc.createPhotoUploadUrl('u1', { contentType: 'image/png', contentLength: 6 * 1024 * 1024 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when the user has no account', async () => {
    const prisma = { account: { findUnique: jest.fn().mockResolvedValue(null) } } as any;
    const svc = new MediaService(makeConfig(), prisma);
    await expect(svc.createPhotoUploadUrl('u1', { contentType: 'image/jpeg', contentLength: 10 })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 3: Запустить — убедиться, что падает**

Run: `npm test -w @friends-ai/api -- "media.service|env.schema"`
Expected: FAIL — `Cannot find module './media.service'` и/или отсутствуют S3-дефолты.

- [ ] **Step 4: Добавить S3 в env-схему и конфиг**

Modify `apps/api/src/config/env.schema.ts` — добавить в объект `envSchema` (перед закрывающей `})`):

```ts
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('friends-media'),
  S3_ACCESS_KEY: z.string().default('minio'),
  S3_SECRET_KEY: z.string().default('changeme123'),
  S3_PUBLIC_URL: z.string().url().default('http://localhost:9000/friends-media'),
  S3_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
```

Modify `apps/api/src/config/config.service.ts` — добавить геттеры (перед закрывающей `}` класса):

```ts
  get s3Endpoint(): string { return this.config.get('S3_ENDPOINT', { infer: true }); }
  get s3Region(): string { return this.config.get('S3_REGION', { infer: true }); }
  get s3Bucket(): string { return this.config.get('S3_BUCKET', { infer: true }); }
  get s3AccessKey(): string { return this.config.get('S3_ACCESS_KEY', { infer: true }); }
  get s3SecretKey(): string { return this.config.get('S3_SECRET_KEY', { infer: true }); }
  get s3PublicUrl(): string { return this.config.get('S3_PUBLIC_URL', { infer: true }); }
  get s3UploadMaxBytes(): number { return this.config.get('S3_UPLOAD_MAX_BYTES', { infer: true }); }
```

Modify `.env.example` — заменить блок MinIO на полный набор S3-переменных:

```bash
# MinIO (S3-compatible object storage)
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=changeme123
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=friends-media
S3_ACCESS_KEY=minio
S3_SECRET_KEY=changeme123
# Публичная база URL для отдачи фото (endpoint + bucket).
S3_PUBLIC_URL=http://localhost:9000/friends-media
S3_UPLOAD_MAX_BYTES=5242880
```

- [ ] **Step 5: Реализовать media-модуль**

Create `apps/api/src/media/dto/create-photo-upload-url.dto.ts`:

```ts
import { IsInt, IsPositive, IsString } from 'class-validator';

export class CreatePhotoUploadUrlDto {
  @IsString()
  contentType!: string;

  @IsInt()
  @IsPositive()
  contentLength!: number;
}
```

Create `apps/api/src/media/media.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { PhotoUploadUrlResponse } from '@friends-ai/contracts';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhotoUploadUrlDto } from './dto/create-photo-upload-url.dto';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const URL_TTL_SECONDS = 900;

@Injectable()
export class MediaService {
  private readonly s3: S3Client;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      endpoint: config.s3Endpoint,
      region: config.s3Region,
      credentials: { accessKeyId: config.s3AccessKey, secretAccessKey: config.s3SecretKey },
      forcePathStyle: true,
    });
  }

  async createPhotoUploadUrl(userId: string, dto: CreatePhotoUploadUrlDto): Promise<PhotoUploadUrlResponse> {
    const ext = EXT_BY_MIME[dto.contentType];
    if (!ext) throw new BadRequestException('Unsupported content type');
    if (dto.contentLength > this.config.s3UploadMaxBytes) throw new BadRequestException('File too large');

    const account = await this.prisma.account.findUnique({ where: { ownerUserId: userId } });
    if (!account) throw new NotFoundException('Account not found');

    const objectKey = `accounts/${account.id}/${randomUUID()}.${ext}`;
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.config.s3Bucket, Key: objectKey, ContentType: dto.contentType }),
      { expiresIn: URL_TTL_SECONDS },
    );

    return {
      uploadUrl,
      objectKey,
      publicUrl: `${this.config.s3PublicUrl}/${objectKey}`,
      expiresIn: URL_TTL_SECONDS,
    };
  }
}
```

Create `apps/api/src/media/media.controller.ts`:

```ts
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PhotoUploadUrlResponse } from '@friends-ai/contracts';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { MediaService } from './media.service';
import { CreatePhotoUploadUrlDto } from './dto/create-photo-upload-url.dto';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('photo-upload-url')
  @HttpCode(200)
  createUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: CreatePhotoUploadUrlDto): Promise<PhotoUploadUrlResponse> {
    return this.media.createPhotoUploadUrl(user.id, dto);
  }
}
```

Create `apps/api/src/media/media.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
```

Modify `apps/api/src/app.module.ts` — импортировать и добавить `MediaModule` в `imports`:

```ts
import { MediaModule } from './media/media.module';
```

- [ ] **Step 6: Привязать фото к участнику**

Modify `apps/api/src/accounts/dto/update-member.dto.ts` — добавить поле:

```ts
  @IsOptional()
  @IsString()
  photoObjectKey?: string;
```

Modify `apps/api/src/accounts/accounts.service.ts`:

1) добавить инъекцию конфига в конструктор:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}
```
(импорт: `import { AppConfigService } from '../config/config.service';`)

2) в методе `updateMember`, перед вызовом `this.prisma.accountMember.update`, добавить обработку ключа:

```ts
    if (dto.photoObjectKey !== undefined) {
      const prefix = `accounts/${account.id}/`;
      if (!dto.photoObjectKey.startsWith(prefix)) throw new BadRequestException('Object key outside account namespace');
      data.photoUrl = `${this.config.s3PublicUrl}/${dto.photoObjectKey}`;
    }
```
(`BadRequestException` уже импортирован.)

3) обновить фабрику сервиса в `apps/api/src/accounts/accounts.service.spec.ts` — конструктор теперь двухаргументный:

```ts
const newService = (prisma: any) =>
  new AccountsService(prisma, { s3PublicUrl: 'http://localhost:9000/friends-media' } as any);
```

4) добавить unit-тест на проверку неймспейса ключа — append в `accounts.service.spec.ts`:

```ts
describe('AccountsService.updateMember photo attach', () => {
  it('rejects an object key outside the account namespace', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', members: [{ id: 'm0', position: 0 }] }) },
    } as any;
    const svc = newService(prisma);
    await expect(
      svc.updateMember('u1', 'm0', { photoObjectKey: 'accounts/OTHER/x.jpg' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 7: Запустить unit — убедиться, что проходит**

Run: `npm test -w @friends-ai/api -- "media.service|env.schema|accounts.service"`
Expected: PASS.

- [ ] **Step 8: Добавить e2e presign + attach**

Append inside `apps/api/test/accounts.e2e-spec.ts`:

```ts
  it('mints a presigned upload url and attaches the photo to a member', async () => {
    const token = await newUserToken();
    const created = await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);
    const memberId = created.body.members[0].id;

    const presign = await request(app.getHttpServer())
      .post('/api/v1/media/photo-upload-url').set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/jpeg', contentLength: 12345 })
      .expect(200);
    expect(presign.body.objectKey).toMatch(/^accounts\/[^/]+\/[a-f0-9-]+\.jpg$/);
    expect(presign.body.uploadUrl).toContain('http');

    const attached = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/me/members/${memberId}`).set('Authorization', `Bearer ${token}`)
      .send({ photoObjectKey: presign.body.objectKey })
      .expect(200);
    expect(attached.body.members[0].photoUrl).toBe(presign.body.publicUrl);
  });

  it('rejects an unsupported photo content type (400)', async () => {
    const token = await newUserToken();
    await request(app.getHttpServer())
      .post('/api/v1/accounts').set('Authorization', `Bearer ${token}`)
      .send({ kind: AccountKind.Single, cityId, members: [{ name: 'A', age: 30 }], interestSlugs: ['coffee', 'books'], intents: [Intent.Walks] })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/media/photo-upload-url').set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'application/pdf', contentLength: 10 })
      .expect(400);
  });
```

- [ ] **Step 9: Запустить e2e — убедиться, что проходит**

Run: `npm run test:e2e -w @friends-ai/api -- accounts.e2e`
Expected: PASS.

- [ ] **Step 10: Коммит**

```bash
git add apps/api/src/media apps/api/src/config apps/api/src/accounts apps/api/src/app.module.ts apps/api/package.json package-lock.json .env.example apps/api/test/accounts.e2e-spec.ts
git commit -m "[FDM-6] media: presigned photo upload + attach to member

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Финальная проверка + документация

**Files:**
- Modify: `README.md` (короткий раздел о профильном API)
- (Проверка) весь `apps/api`

**Interfaces:**
- Consumes: всё предыдущее. Ничего нового не производит — это гейт качества и документация.

- [ ] **Step 1: Полный прогон unit + typecheck + lint**

Run:
```bash
npm run build:contracts
npm run typecheck -w @friends-ai/api
npm run lint -w @friends-ai/api
npm test -w @friends-ai/api
```
Expected: всё зелёное. При ошибках lint/type — исправить в соответствующих файлах и перезапустить.

- [ ] **Step 2: Полный прогон e2e**

Run: `npm run test:e2e -w @friends-ai/api`
Expected: все наборы (`accounts-model`, `seed`, `catalog`, `accounts.e2e`, а также существующие auth/health) — PASS.

- [ ] **Step 3: Обновить README**

Modify `README.md` — добавить после раздела «Тесты» короткий раздел:

```markdown
## Профили и города (FDM-6)

Публичные справочники: `GET /api/v1/cities`, `GET /api/v1/interests`.
Профиль (требует Bearer-токен): `POST /api/v1/accounts` (онбординг),
`GET/PATCH /api/v1/accounts/me`, `PATCH /api/v1/accounts/me/kind`,
`PATCH /api/v1/accounts/me/members/:id`.
Фото: `POST /api/v1/media/photo-upload-url` (presigned PUT в S3/MinIO),
затем привязка ключа через `PATCH .../members/:id { photoObjectKey }`.

Сид справочных данных (Ярославль + интересы): `npm run db:seed -w @friends-ai/api`.
```

- [ ] **Step 4: Коммит (закрывает задачу)**

```bash
git add README.md
git commit -m "[FDM-6] docs: profile & media API in README

Closes #6

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Заметки по реализации

- **Presigned URL не ходит в сеть.** `getSignedUrl` подписывает URL локально, поэтому unit/e2e не требуют поднятого MinIO — Testcontainers остаются на Postgres + Redis. Реальный `PUT` файла делает клиент; создание бакета в MinIO — вне scope этого плана (для локальной отдачи фото бакет `friends-media` создаётся вручную в консоли MinIO :9001).
- **GIN вручную (Task 2, Step 5).** Если позже `prisma migrate dev` перегенерирует миграции — строку `CREATE INDEX ... USING GIN` нужно сохранить/перенести; e2e `accounts-model` это ловит.
- **Приватность.** Ответы всегда через `toMyAccountResponse` — никогда не возвращать сырой Prisma-объект `Account` (в нём `ownerUserId`). e2e `accounts.e2e` проверяет отсутствие `ownerUserId` в теле.
- **Enum-каст.** `account.kind`/`account.status`/`account.intents` кастуются к контрактным enum-типам в маппере; значения байт-в-байт совпадают с БД (Prisma-enum `single|couple`, `active|hidden|banned`; `intents` — сырые строки). Тест `profiles.spec.ts` + `enums.spec.ts` фиксируют значения.
- **`forbidNonWhitelisted`.** Любое лишнее поле в теле запроса → 400. Вложенные DTO (`members`, `secondMember`) требуют `@Type()`.
