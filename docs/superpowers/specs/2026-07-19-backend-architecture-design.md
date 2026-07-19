# friends.ai — архитектура бэкенда (дизайн)

**Дата:** 2026-07-19
**Статус:** согласовано, готово к написанию плана реализации
**Автор:** Max + Claude (brainstorming)

## 1. Контекст и цель

Переписываем начисто fullstack-приложение для знакомств и поиска друзей (для
одиночек и пар). Текущий проект — фронтенд-набросок (React + Vite + TS, моки в
`localStorage`) — остаётся как **референс** доменной модели и дизайна.

Задача этого документа — спроектировать **бэкенд** и общую архитектуру системы.

**Функционал MVP:**

1. Регистрация / вход.
2. Онбординг: тип аккаунта (single / пара), профиль, интересы, цели (intents).
3. Дискавери: свайп «да/нет» + матчинг по совместимости.
4. Чат между мэтчами (realtime).
5. Каталог заведений по категориям, по городу.

**Целевой рынок:** Ярославль — первый и единственный город на старте.
Масштабирование на другие города — обязательное требование к бэкенду
(закладываем архитектурно, не реализуем на MVP).

## 2. Технологические решения (зафиксированы)

| Область | Выбор | Обоснование |
|---|---|---|
| Backend framework | **NestJS + TypeScript** | Модули, DI, гварды, WS-gateway из коробки |
| Frontend | **React + TS + Vite (SPA)** | Переносим текущий набросок начисто |
| БД | **PostgreSQL** | Транзакции (матч+чат атомарно), реляционность, гео |
| ORM | **Prisma** | Лучший TS-DX, автотипы, удобные миграции |
| Кэш / realtime / очереди | **Redis** | Rate-limit, refresh-сессии, коды (TTL), Socket.IO-адаптер, BullMQ |
| Realtime | **Socket.IO** через Nest Gateway | Комнаты, реконнект, статусы/typing |
| Файлы | **S3-совместимое** (MinIO локально → Selectel S3 в проде) | Фото профилей и заведений |
| Auth | **Passport (JWT)** + argon2id + Yandex SmartCaptcha | Access/refresh, антибот |
| Фоновые задачи | **BullMQ** (на Redis) | Пересчёт совместимости, письма, будущий импорт |
| API-контракт | **REST + OpenAPI** (`/api/v1`), генерируемый TS-клиент | Стандартно, готово к мобилке/публичному API |
| Тесты | **Jest + Supertest + Testcontainers** | Юнит + e2e на реальном Postgres |
| Внутренняя админка | **AdminJS** (Prisma-адаптер) | Мгновенный CRUD без построения UI руками |

### 2.1. Хостинг

**РФ-VPS + Docker Compose** у российского провайдера (Timeweb / Selectel / Aeza
и т.п.), ориентир ~1.5–3к ₽/мес на старте. Соответствие **152-ФЗ** (данные ПДн
в РФ) достигается выбором РФ-провайдера.

Ключевой принцип: Postgres / Redis / файловое хранилище оформлены как
**вынесенные зависимости** (через конфиг/переменные окружения), поэтому переезд
на managed-сервисы при росте — это lift-and-shift без переписывания кода.

Managed-облако (Yandex Cloud / VK Cloud, ~8–15к ₽/мес) — осознанно отложено:
разница почти целиком в managed PostgreSQL/Redis, на одном городе это оверкилл.

## 3. Архитектура: модульный монолит

Выбран **модульный монолит** (один NestJS-процесс с изолированными
feature-модулями) вместо микросервисов или монолита с выделенным realtime.

**Почему:** даёт ~90% пользы чистой архитектуры (изолированные, тестируемые
модули с явными интерфейсами) при ~20% сложности эксплуатации. Одна
транзакционная БД позволяет создавать матч и чат атомарно. Границы модулей = 
будущие границы сервисов: путь роста «монолит → выносим горячие модули →
сервисы» открыт и не требует переделки.

**Правило изоляции:** модуль не обращается к таблицам соседа напрямую — только
через сервис-интерфейс соседнего модуля.

### 3.1. Схема развёртывания

```
[React SPA] --HTTPS/WSS--> [Nginx: reverse proxy + TLS]
                                     |
                          [NestJS — модульный монолит]
       модули: auth · users/profiles · discovery · chat(WS) ·
               venues · moderation · admin · cities/geo
                                     |
              [PostgreSQL]   [Redis]   [S3 / MinIO]
     (всё — контейнеры Docker Compose на одном VPS)
```

### 3.2. Структура репозитория (монорепо)

```
friends-ai/
├─ apps/
│  ├─ web/            # SPA: React + Vite + TS (переносим начисто с референса)
│  └─ api/            # NestJS модульный монолит
│     └─ src/modules/{auth,users,discovery,chat,venues,moderation,admin,cities}
├─ packages/
│  └─ contracts/      # общие enum/DTO/типы — источник правды для FE и BE
├─ docker-compose.yml # postgres, redis, minio, api, web(nginx)
└─ ...
```

`packages/contracts` — общие `Intent`, `AccountKind`, категории и типы ответов,
импортируются обоими приложениями. Сквозная типизация FE↔BE без дублирования.

## 4. Модель данных

Нотация Prisma, сокращённо (поля-таймстемпы и очевидные опущены).

```prisma
// ── Гео / мультигород ─────────────────────────────
model City   { id, slug @unique, name, timezone, centerLat, centerLng, isActive }

// ── Идентичность (auth отделён от профиля) ─────────
model User         { id, role(user|moderator|admin), status(active|blocked), createdAt }
model AuthIdentity { id, userId, provider(password|phone|vk|yandex),
                     identifier,        // email / телефон / vk-id, @@unique([provider, identifier])
                     secretHash?, verifiedAt? }   // password → argon2id-хэш
// refresh-сессии, коды подтверждения email, токены сброса пароля — в Redis (TTL), не в БД

// ── Профиль (single | couple) ─────────────────────
model Account       { id, ownerUserId, kind(single|couple), cityId,
                       bio, status(active|hidden|banned), lastActiveAt,
                       intents Intent[] }          // enum[] + GIN-индекс
model AccountMember { id, accountId, name, age, photoUrl }  // 1 строка (single) / 2 (couple)
model Interest      { id, slug @unique, label, isActive }   // курируемый справочник
model AccountInterest { accountId, interestId }             // M:N

// ── Дискавери / матчинг ───────────────────────────
model Swipe { id, fromAccountId, toAccountId, decision(like|skip), createdAt,
              @@unique([fromAccountId, toAccountId]) }
model Match { id, accountAId, accountBId, createdAt, status(active|closed),
              @@unique([accountAId, accountBId]) }  // пара нормализована (min,max)

// ── Чат ────────────────────────────────────────────
model Conversation            { id, matchId @unique, createdAt, lastMessageAt }
model ConversationParticipant { conversationId, accountId, lastReadAt }  // read-указатель
model Message                 { id, conversationId, senderAccountId, body, createdAt,
                                @@index([conversationId, createdAt]) }

// ── Каталог заведений ──────────────────────────────
model VenueCategory { id, slug @unique, label, iconKey, sortOrder }
model Venue         { id, cityId, categoryId, name, description, address,
                      lat, lng, priceLevel?, coverPhotoUrl, status(draft|published),
                      @@index([cityId, categoryId, status]) }
model VenuePhoto    { id, venueId, url, sortOrder }

// ── Модерация ──────────────────────────────────────
model Report { id, reporterAccountId, targetType(account|message|venue), targetId,
               reason, status(open|resolved|rejected), createdAt }
model Block  { id, blockerAccountId, blockedAccountId, createdAt,
               @@unique([blockerAccountId, blockedAccountId]) }
```

**Ключевые решения модели:**

1. **Auth ≠ профиль.** `User` — «кто вошёл» (роль, статус, бан). `Account` — «что
   видят другие». `AuthIdentity.provider` — абстракция identity-провайдера: на MVP
   только `password`, добавить `phone`/`vk` позже = новые строки, без миграции логики.
2. **Single/couple** — через 1 или 2 строки `AccountMember`. Никаких nullable-полей
   «второго человека».
3. **`intents` — `enum[]` + GIN-индекс** (маленький фиксированный набор, быстрый
   overlap). **`interests` — справочник + M:N** (курируется, растёт). Осознанная асимметрия.
4. **Read-статусы — указатель `lastReadAt` на участника**, не строка-на-сообщение.
   `ConversationParticipant` заложен под будущие групповые чаты.
5. **Секреты не в БД** — refresh-сессии, коды, токены сброса в Redis с TTL.
6. **`cityId` на `Account` и `Venue`** — ось масштабирования (см. §8).

## 5. Дискавери и матчинг

**Формирование колоды.** Для аккаунта `A` кандидаты `B` (запрос по индексу
`(cityId, status)`):

- `B.cityId = A.cityId`, `B.status = active`, `B.id ≠ A.id`;
- `A` ещё не свайпал `B` (анти-join к `Swipe`);
- нет `Block` между `A` и `B` в обе стороны;
- (опционально) пересечение хотя бы по одному `intent`.

**Совместимость — детерминированная, на чтении** (без ML на старте):

```
score = round( 100 * (0.6 * jaccard(interests_A, interests_B)
                     + 0.4 * overlapRatio(intents_A, intents_B)) )
```

+ тай-брейк по свежести (`lastActiveAt`). Это и есть `compatibility: 0–100` из
референса (кольцо совместимости), только настоящий.

**Отдача колоды:** `GET /api/v1/discovery/deck?limit=20` — батч кандидатов по
индексу (минус свайпнутые/заблокированные), расчёт score, сортировка по убыванию
с лёгкой рандомизацией верхушки, cursor-пагинация.

**Свайп и рождение матча (атомарно):**

```
POST /api/v1/discovery/swipe { toAccountId, decision: like | skip }
  1. INSERT Swipe (идемпотентно — @@unique(from,to))
  2. если decision=like И существует встречный like (B→A):
       BEGIN TX
         создать Match (пара нормализована min/max)
         создать Conversation(matchId)
       COMMIT
       → WS-событие "match:new" аккаунту B (если онлайн)
       → { matched: true, matchId }
     иначе → { matched: false }
```

Транзакция гарантирует: нет матча без чата и наоборот.

## 6. Realtime-чат

**Транспорт:** Socket.IO, namespace `/chat`, JWT-проверка на handshake →
`accountId` привязан к сокету.

**Комнаты:** `conv:{conversationId}` на диалог + `account:{id}` на
матчи/присутствие.

**События:**

| Направление | Событие | Действие |
|---|---|---|
| c→s | `message:send {conversationId, body, clientMsgId}` | guard (участник + не заблокирован) → persist `Message`, обновить `lastMessageAt` → **ack** (серверный `id`+`createdAt`) → broadcast `message:new` |
| c→s | `typing:start` / `typing:stop` | broadcast в комнату, не сохраняется |
| c→s | `message:read {conversationId, lastMessageId}` | обновить `lastReadAt` → broadcast `read` |
| s→c | `message:new`, `typing`, `read`, `presence`, `match:new` | доставка живых событий |

**Статусы:** одна галочка — по серверному ack; две — когда получатель прислал
`message:read` (вычисляется как `lastReadAt ≥ message.createdAt`).

**Присутствие** — в Redis (множество онлайн + TTL-heartbeat), работает при
нескольких инстансах.

**Масштабирование сокетов** — `@socket.io/redis-adapter` с первого дня: broadcast
через Redis pub/sub долетает до клиентов на любом инстансе. На MVP инстанс один,
адаптер уже подключён.

**История — по REST:** `GET /api/v1/conversations/:id/messages?cursor=` (cursor по
`(conversationId, createdAt)`). WebSocket — только «живое». Оптимистичный рендер
мирится по `clientMsgId` (сервер возвращает его в ack и в `message:new`).

**Оффлайн:** сообщения сохраняются всегда; при реконнекте — история + счётчик
непрочитанного из `lastReadAt`. Push на MVP нет — только бейдж непрочитанного.

## 7. Auth и безопасность

**Токены (JWT + ротация):**

- **Access** — ~15 мин, stateless JWT (`userId`, `accountId`, `role`), в памяти SPA.
- **Refresh** — ~30 дней, непрозрачный токен в **httpOnly + Secure + SameSite
  cookie**; в Redis как allowlist по сессии → мгновенный отзыв.
- **Ротация** на каждом refresh; повторное использование старого токена →
  отзыв всей «семьи». Access в памяти + refresh в httpOnly — защита и от XSS, и от CSRF.

**Регистрация/восстановление:** пароли — argon2id; подтверждение email
обязательно до появления профиля в дискавери; коды/токены в Redis с TTL;
**Yandex SmartCaptcha** на регистрации, сбросе пароля, после N неудачных логинов.

**Защита эндпоинтов:** `@nestjs/throttler` на Redis (rate-limit по IP + аккаунту
на auth/свайпах/`message:send`, антибрутфорс); RBAC-гварды
(`user|moderator|admin`) + проверки владения ресурсом; глобальный
`ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) + DTO; HTTPS-only + HSTS;
CORS замкнут на origin SPA; конфиг через `@nestjs/config` с валидацией схемы,
секреты — только в env.

**Приватность и геоданные (152-ФЗ + безопасность людей):**

- **Точные координаты пользователей не храним и не отдаём** — у `Account` только
  `cityId`. «Расстояние» (если появится) — храним огрублённо, отдаём только
  приблизительную/бакетированную дистанцию.
- В публичных ответах — только поля `Account`; `User`/email/телефон наружу не утекают.
- `Block` соблюдается везде (дискавери, чат, профиль).
- Точные координаты — только у `Venue` (публичные места).
- Минимизация ПДн, согласие на обработку + политика приватности на регистрации.

## 8. Мультигород и масштабирование

Главная ось — `cityId` (на `Account` и `Venue`; `VenueCategory` глобальны).
Каждый запрос дискавери/каталога фильтруется по городу, индексы начинаются с `cityId`.

**Новый город = вставка строки `City` + сид категорий/заведений + `isActive=true`.**
Ни миграций, ни изменений кода. `isActive` — soft-launch города.

**Путь роста нагрузки** (заложен, на MVP не реализуем):

1. Вертикально — VPS побольше.
2. Stateless-API → N инстансов за LB, sticky-сессии для WS (Redis-адаптер уже есть).
3. Read-реплики Postgres для тяжёлого чтения (колода, каталог).
4. **`cityId` — естественный ключ шардирования/партиционирования** больших таблиц.
5. Медиа → managed S3, БД → managed Postgres (lift-and-shift).

**Фоновые задачи (BullMQ):** пересчёт совместимости, письма, очистка; позже —
предпосчёт персональной колоды кандидатов (когда анти-join по свайпам станет
тяжёлым) и импорт заведений.

## 9. Модерация, админка, медиа

**Модерация:** `Report` (аккаунт/сообщение/заведение) + `Block`. Роль `moderator`
видит очередь открытых репортов; действия: скрыть аккаунт, бан
(`User.status=blocked`), удалить заведение/сообщение. Фото — **пост-модерация** на
MVP (реагируем на репорты); пре-модерация — позже при злоупотреблениях.

**Админка:** модуль `admin` в том же процессе под RBAC. **AdminJS** (Prisma-адаптер)
даёт готовый CRUD для курации заведений/категорий, очереди репортов, управления
пользователями/городами — без построения UI руками.

**Медиа (фото):** клиент просит **presigned PUT-URL** (`POST /api/v1/media/upload-url`),
грузит файл напрямую в S3/MinIO, присылает ключ; API валидирует mime/размер и
сохраняет ссылку. Ресайз-превью — фоновым BullMQ-джобом (`sharp`).

## 10. Тестирование, API-контракт, эксплуатация

**Тестирование:**

- Unit (Jest): формула совместимости, ротация токенов, гварды/политики.
- e2e (Supertest) на реальном Postgres через Testcontainers: auth-флоу,
  свайп→матч, отправка/прочтение в чате, каталог.
- WS-тесты: `socket.io-client` против поднятого gateway.
- Отдельная тест-БД на прогон, миграции применяются автоматически.

**API-контракт:** REST `/api/v1`, документация `@nestjs/swagger` → OpenAPI;
из OpenAPI генерируется типизированный TS-клиент для SPA (`orval` /
`openapi-typescript`); общие enum/DTO — в `packages/contracts`.

**Эксплуатация:** `docker-compose` (postgres, redis, minio, api, web/nginx) —
локально и в проде (паритет окружений); миграции — Prisma Migrate на деплое;
`/health` для LB; конфиг валидируется на старте; бэкапы — `pg_dump` cron → S3;
логи — структурные (`pino`), без ПДн; CI: lint → typecheck → test → build.

## 11. Явно вне scope MVP (stage 2+)

- Телефон/SMS и VK/Yandex OAuth (абстракция `AuthIdentity` готова).
- Push-уведомления.
- Вложения-фото в чате.
- Импорт заведений из 2ГИС/Яндекс (модель `Venue` готова).
- Предпосчёт колоды кандидатов в Redis.
- Пре-модерация фото, профанити-фильтр.
- ML-ранжирование совместимости.
- Managed-инфраструктура, шардирование по городам, read-реплики.
- Геолокация/«расстояние» между пользователями.

## 12. Открытые вопросы

- Провайдер SMS и параметры Yandex SmartCaptcha — уточнить при подключении
  (не блокирует MVP, т.к. вход на старте — email+пароль).
- Конкретный РФ-VPS провайдер и объём хранилища S3 — на этапе деплоя.
