# FDM-6 — Профили и города (дизайн)

**Дата:** 2026-07-21
**Статус:** согласовано, готово к написанию плана реализации
**Автор:** Max + Claude (brainstorming)
**Задача:** [FDM-6](https://github.com/Alemy75/friends-discovery-monorepo/issues/6) — Profiles & cities
**Опирается на:** [архитектурный дизайн бэкенда](2026-07-19-backend-architecture-design.md) §4 (модель данных), §5 (совместимость — потребитель), §7 (приватность), §8 (мульти-город), §9 (медиа)

## 1. Контекст и цель

Второй вертикальный слой бэкенда после Auth (FDM-5). Вводит доменное ядро
продукта: **аккаунт** (одиночка / пара), его **участники**, **интересы**,
**цели (intents)**, привязку к **городу**, онбординг и редактирование профиля,
а также загрузку фото. На эти сущности опираются все последующие задачи —
Discovery (FDM-7), Chat (FDM-8), Venues (FDM-9), Moderation (FDM-10).

Референс доменной модели — фронтенд-набросок в `reference/web-reference`
(4-шаговый онбординг, ~20 интересов, single = 1 человек / couple = 2).

### Критерии приёмки (из задачи)

- [ ] Модель `City` + сид (Ярославль); всё профильное city-scoped через `cityId`
- [ ] `Account` (single | couple) + `AccountMember` (1–2 человека) + `Interest` (M:N) + `intents`
- [ ] Онбординг + CRUD профиля (редактирование только своего аккаунта)
- [ ] Загрузка фото через presigned S3 URL (валидация mime/size); задача на превью
- [ ] Публичные ответы профиля отдают только поля `Account` (без утечки `User`/email)

## 2. Что уже есть в кодовой базе

- **`City`** уже описан в `apps/api/prisma/schema.prisma` (`id` cuid, `slug`
  @unique, `name`, `timezone`, `centerLat`, `centerLng`, `isActive`,
  `createdAt`, таблица `cities`). Строки Ярославля нет; механизма сидов в репо
  нет вообще (нет `prisma/seed.ts`, нет seed-скрипта в `package.json`).
- **Enum'ы `AccountKind`** (`single`/`couple`) и **`Intent`**
  (`walks`, `double-dates`, `hobby`, `travel`, `deep-talks`, `events`) уже
  объявлены в `packages/contracts/src/enums.ts` с нужными строковыми
  значениями. Импортеров нет — FDM-6 их первый потребитель. **Не переопределять.**
- **Auth-инфраструктура жива:** глобальные `JwtAuthGuard` → `RolesGuard`
  (каждый маршрут защищён по умолчанию; `@Public()` снимает защиту, `@Roles()`
  ограничивает, `@CurrentUser()` даёт `{id, role}`). Глобальный
  `PrismaExceptionFilter` (P2002→409, P2025→404) и Redis-throttler активны.
- **Инфрамодули** `PrismaService`, `RedisService`, `AppConfigService`,
  `MailService` — `@Global()`, инжектятся напрямую. Feature-модули лежат плоско
  в `src/<feature>/` и регистрируются вручную в `app.module.ts`.
- **`docker-compose`** уже поднимает MinIO (порты 9000/9001) рядом с
  postgres:16 и redis:7. Но S3-переменных в `env.schema.ts` пока нет, BullMQ в
  приложение не подключён.
- **Email-verify:** гейт — `AuthIdentity.verifiedAt` (FDM-5).

## 3. Решения (зафиксированы на brainstorming)

| # | Решение | Выбор |
|---|---|---|
| 1 | Объём медиа в FDM-6 | **Гибрид:** presigned-загрузка + валидация mime/size сейчас; асинхронный воркер превью (BullMQ + sharp) — отдельной задачей |
| 2 | Гейт email-верификации | **Discovery-time:** онбординг доступен сразу после регистрации; неверифицированные скрываются из выдачи позже (FDM-7) |
| 3 | Смена `kind` после онбординга | **Редактируемо:** переключение single↔couple с атомарным добавлением/удалением `AccountMember` |
| 4 | Интересы | **Строгий каталог:** только активные slug'и из справочника (мин. 2); сид ~20 интересов |
| 5 | Статус профиля | Отдельный enum **`ProfileStatus(active\|hidden\|banned)`**; auth-`AccountStatus(active\|blocked)` не трогаем |
| 6 | Один аккаунт на пользователя | **`@@unique(ownerUserId)`** (1:1) + сервисная пред-проверка (ConflictException) |
| 7 | Инвариант числа участников | **На уровне приложения** (1 для single, 2 для couple); без DB-constraint |
| 8 | Сиды (город + интересы) | **`prisma/seed.ts`** (идемпотентный upsert по slug) — заводим механизм в репо |
| 9 | `ProfileCard` / compatibility / likesYou | **Вне FDM-6** → discovery (FDM-7) |
| 10 | Хранение `intents` | **`String[]`** (значения контрактного enum), GIN-индекс; не Prisma-enum (см. §4) |

## 4. Модель данных

`City` — без изменений. Новые модели и enum:

```prisma
enum ProfileStatus { active  hidden  banned }   // НОВЫЙ; ≠ auth AccountStatus(active|blocked)

model Account {
  id           String        @id @default(cuid())
  ownerUserId  String        @unique                 // один аккаунт на пользователя (1:1)
  owner        User          @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  kind         AccountKind                            // Prisma-enum: single|couple (валидные идентификаторы)
  cityId       String
  city         City          @relation(fields: [cityId], references: [id])
  bio          String?
  status       ProfileStatus @default(active)
  intents      String[]                               // значения Intent; валидируются в приложении; GIN-индекс
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
  position  Int                                        // 0 = основной, 1 = партнёр (стабильный порядок)
  name      String
  age       Int
  photoUrl  String?
  @@unique([accountId, position])
  @@map("account_members")
}

model Interest {
  id       String  @id @default(cuid())
  slug     String  @unique
  label    String                                      // ru-подпись (i18n на стороне API)
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

### 4.1. Почему `intents` — `String[]`, а не Prisma-enum

Значения контрактного `Intent` содержат дефисы (`double-dates`, `deep-talks`).
Prisma-enum потребовал бы `@map`, и тогда клиент отдаёт **имя** члена
(`doubleDates`), а в БД лежит **значение** (`double-dates`) — ровно тот дрейф,
что опасен, поскольку сервисы кастуют `prismaValue as ContractEnum` без
рантайм-проверки. Храня строковые значения контракта прямо в `String[]`, мы
держим байты в БД идентичными контракту, валидируем в приложении против enum
`Intent` (мин. 1, уникальные), и индексируем GIN для запроса пересечения (§5).
`kind` остаётся настоящим Prisma-enum (`single`/`couple` — валидные
идентификаторы, каст безопасен).

### 4.2. GIN-индекс

Prisma не генерирует `USING GIN` для скалярного массива. В миграции **вручную**
добавляем `CREATE INDEX accounts_intents_gin ON accounts USING GIN (intents);`
с комментарием, что правку нужно сохранять при будущих `prisma migrate diff`.
Иначе запрос пересечения intents из §5 молча деградирует в seq scan.

## 5. API (`/api/v1`)

| Метод | Путь | Auth | Назначение |
|---|---|---|---|
| GET | `/cities` | `@Public` | активные города для выбора в онбординге |
| GET | `/interests` | `@Public` | активный каталог интересов (`{slug,label}`) |
| POST | `/accounts` | JWT | онбординг — создать свой аккаунт; 409 если уже есть |
| GET | `/accounts/me` | JWT | свой профиль (`MyAccountResponse`) |
| PATCH | `/accounts/me` | JWT | правка bio / interests / intents |
| PATCH | `/accounts/me/kind` | JWT | смена single↔couple (транзакционно) |
| PATCH | `/accounts/me/members/:id` | JWT | правка участника (name/age) + привязка фото |
| POST | `/media/photo-upload-url` | JWT | presigned PUT (валидация mime/size, ключ на сервере) |

- **Владелец-only** проверяется в сервисе (`account.ownerUserId === currentUser.id`),
  дублируется `@@unique`.
- Каждый ответ идёт через **явный DTO-маппер**, никогда не сырой Prisma-объект
  (приватность §7: без `ownerUserId`/email).

## 6. Ключевые сценарии

- **Онбординг** (`POST /accounts`): валидируем `kind`; `cityId` существует и
  активен; число участников соответствует `kind` (1/2); у каждого имя непустое,
  возраст 18–99; `interestSlugs` ≥2, уникальны, все в активном каталоге;
  `intents` ≥1, уникальны, валидны. Создание `Account` + участников + связей с
  интересами в одной транзакции. Гейта верификации здесь нет (discovery-time).
- **Смена kind** (`PATCH /accounts/me/kind`): `single→couple` требует в теле
  данные второго участника `{name, age}` → вставка на `position:1`;
  `couple→single` удаляет участника `position:1` (и сбрасывает его фото).
  Атомарная транзакция, проверка итогового состояния.
- **Загрузка фото**: клиент вызывает `POST /media/photo-upload-url
  {contentType, contentLength}` → сервер валидирует (`image/jpeg|png|webp`,
  ≤5 MB), генерирует ключ `accounts/{accountId}/{memberId}/{uuid}.{ext}`,
  возвращает `{uploadUrl, objectKey, publicUrl, expiresIn}`. Клиент делает PUT
  на `uploadUrl`, затем `PATCH /accounts/me/members/:id` с `objectKey`; сервер
  проверяет, что ключ в неймспейсе этого аккаунта, и сохраняет `photoUrl`.

## 7. Контракты (`packages/contracts`)

Response-DTO — плоские интерфейсы, реквест-DTO с валидацией живут в
`apps/api/src/<module>/dto`. Всё новое — с баррел-экспортом и `*.spec.ts`.

- **Response/enum (contracts):** `ProfileStatus`; `CityDto {id,slug,name,timezone}`;
  `InterestDto {slug,label}`; `AccountMemberDto {id,position,name,age,photoUrl}`;
  `MyAccountResponse {id,kind,city,bio,status,members[],interests[],intents,lastActiveAt}`;
  `PhotoUploadUrlResponse {uploadUrl,objectKey,publicUrl,expiresIn}`.
- **Подписи целей:** статичная карта `INTENT_LABELS` в contracts (фикс-enum,
  мелочь); подписи интересов приходят из БД (`Interest.label`).
- **Реквест-DTO (apps/api, class-validator):** `CreateAccountDto`,
  `UpdateAccountDto`, `ChangeKindDto` (второй участник обязателен при
  single→couple), `UpdateMemberDto`, `CreatePhotoUploadUrlDto`.

## 8. Сиды, конфиг, тесты

- **Сид (новое для репо):** `prisma/seed.ts` + `package.json` `prisma.seed` +
  скрипт `db:seed`; идемпотентный `upsert` по slug для Ярославля
  (`slug:'yaroslavl'`, `Europe/Moscow`, координаты центра) и ~20 интересов
  (slug + ru-подпись из `reference/web-reference/src/data/constants.ts`).
  Прогоняется в e2e-setup.
- **Конфиг:** добавить S3-ключи (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`,
  `S3_SECRET_KEY`, `S3_REGION`, `S3_PUBLIC_URL`) в `env.schema.ts` **с dev-дефолтами**
  (MinIO), чтобы существующий e2e-bootstrap не падал; геттеры в `AppConfigService`.
- **Тесты:**
  - Unit: валидация DTO; `AccountsService` (создание, чтение, правка,
    транзакция смены kind, owner-guard, проверка каталога);
    `MediaService` (presign, валидация mime/size, неймспейс ключа).
  - e2e (Testcontainers): онбординг → me → patch → смена kind → presign;
    409 при втором аккаунте; **проверки приватности** (нет `ownerUserId`/email);
    публичные `/cities`, `/interests`.
  - Contracts: `*.spec.ts` с проверкой значений enum/DTO.

## 9. Порядок коммитов (один PR, `Closes #6`)

1. Контракты (DTO/enum + specs, `build:contracts`).
2. Prisma: enum + модели `Account`/`AccountMember`/`Interest`/`AccountInterest`
   + миграция (+ ручной GIN) + механизм сидов + сиды.
3. Модуль справочных данных: чтение `/cities`, `/interests`.
4. Модуль `accounts`: онбординг / чтение / правка / смена kind.
5. Модуль `media`: presigned-загрузка + привязка к участнику.
6. e2e + docs (`.env.example`, README).

## 10. Границы (вне scope)

- Асинхронный **воркер превью** (BullMQ + sharp) → отдельная задача.
- **`ProfileCard` + compatibility + `likesYou`** → discovery (FDM-7):
  нужны таблица свайпов и формула §5.
- Дека / свайп / матчинг и сам discovery-time-фильтр скрытия → **FDM-7**.
- Спекулятивные поля фильтрации (пол/ориентация/возрастной диапазон/дистанция)
  — не добавляем.
- AdminJS / модерация → **FDM-10**; города помимо Ярославля → только данные позже.

## 11. Риски

- **GIN вручную**: правку миграции легко потерять при регенерации — держать под
  контролем, покрыть проверкой в e2e (что запрос по intents использует индекс —
  либо хотя бы что индекс существует).
- **Дрейф enum**: значения `Intent` в contracts, в сидах и в референсе должны
  совпадать байт-в-байт; `*.spec.ts` в contracts фиксирует значения.
- **Утечка приватности**: все FK ниже по стеку смотрят на `Account`; легко
  случайно отдать `owner`/email — только через DTO-маппер, не сырой Prisma.
- **contracts перед api**: `npm run build:contracts` до тайпчека `apps/api`,
  иначе «module has no exported member».
- **Смена kind**: несогласованное состояние (пара с 1 участником) — только в
  транзакции.
- **Новые env без дефолтов** ломают e2e-bootstrap, читающий env на импорте
  `AppModule` — задавать `.default()`.
