# friends.ai

Fullstack-приложение для знакомств и поиска друзей — для одиночек и пар.
Первый город — Ярославль; бэкенд спроектирован под масштабирование на другие города.

Монорепо (npm workspaces):

```
apps/
  api/                 # бэкенд: NestJS + TypeScript (модульный монолит)
packages/
  contracts/           # общие типы/enum для FE и BE (@friends-ai/contracts)
reference/
  web-reference/       # исходный фронтенд-набросок (React+Vite+TS) — дизайн-референс
docs/superpowers/
  specs/               # архитектурный дизайн бэкенда
  plans/               # планы реализации
```

Стек бэкенда: NestJS · PostgreSQL (Prisma) · Redis · Socket.IO · S3-совместимое хранилище.
Подробности — в [архитектурном дизайне](docs/superpowers/specs/2026-07-19-backend-architecture-design.md).

## Запуск (локальная разработка)

Поднять инфраструктуру и API в Docker:

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:3000/health        # {"status":"ok", database up, redis up}
```

Только зависимости (postgres/redis/minio) в Docker, а API — локально с hot-reload:

```bash
cp .env.example .env      # раскомментируй блок host-based dev в .env
docker compose up -d postgres redis minio
npm install
npm run start:dev -w @friends-ai/api      # http://localhost:3000/api/v1
```

## Тесты

```bash
npm test                                  # unit-тесты всех пакетов
npm run test:e2e -w @friends-ai/api       # e2e на реальных Postgres/Redis (Testcontainers — нужен Docker)
```

## Профили и города (FDM-6)

Публичные справочники: `GET /api/v1/cities`, `GET /api/v1/interests`.
Профиль (требует Bearer-токен): `POST /api/v1/accounts` (онбординг),
`GET/PATCH /api/v1/accounts/me`, `PATCH /api/v1/accounts/me/kind`,
`PATCH /api/v1/accounts/me/members/:id`.
Фото: `POST /api/v1/media/photo-upload-url` (presigned PUT в S3/MinIO),
затем привязка ключа через `PATCH .../members/:id { photoObjectKey }`.

Сид справочных данных (Ярославль + интересы): `npm run db:seed -w @friends-ai/api`.

## Дизайн-референс

Исходный SPA-набросок (лендинг, auth, онбординг, свайп-поиск, мэтчи+чат, профиль) сохранён
в [`reference/web-reference/`](reference/web-reference/) как ориентир по домену и визуалу.
Продуктовый фронтенд переписывается начисто отдельно.
