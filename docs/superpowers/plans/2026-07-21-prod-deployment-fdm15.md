# Production Deployment Implementation Plan (FDM-15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the artifacts needed to deploy friends.ai (SPA + API) to a fresh Docker-capable VPS over TLS, with migrations-on-release and nightly DB backups — all verifiable locally before any server exists.

**Architecture:** A production Docker Compose stack where **Caddy** is the only public service (auto-TLS): it serves the built SPA as static files and reverse-proxies `/api/*`, `/socket.io/*`, and `/health` to the NestJS `api` container. `api`, `postgres`, `redis`, and a `backup` container live on the internal network only. The existing `apps/api/Dockerfile` + `start:prod` (which runs `prisma migrate deploy` then boots) are reused unchanged, so migrations apply on every release.

**Tech Stack:** Docker Compose, Caddy 2 (auto-HTTPS), Node 20 / Vite (SPA build), NestJS API (existing image), PostgreSQL 16, Redis 7, `pg_dump` + MinIO client `mc` (S3-compatible, for Selectel S3 backups).

**Spec:** [docs/superpowers/specs/2026-07-21-prod-deployment-design.md](../specs/2026-07-21-prod-deployment-design.md)

## Global Constraints

- **Only Caddy publishes host ports** (`80`, `443`). `postgres`, `redis`, `api`, `backup` are internal-only (no `ports:`).
- Every service sets `restart: unless-stopped`.
- Every service uses json-file logging with `max-size: "10m"`, `max-file: "3"` (via a shared YAML anchor).
- **Secrets live only in `.env`** (gitignored). `.env.prod.example` documents every key. Never commit a real `.env`.
- **No API source changes.** Reuse `apps/api/Dockerfile` and the existing `start:prod` script (`prisma migrate deploy && node dist/src/main.js`).
- **Single origin.** The SPA calls the API at the relative path `/api/v1` (hardcoded in `apps/web/src/App.tsx`), so SPA and API share one domain. Caddy forwards `/api/*`, `/socket.io/*`, and `/health` **without stripping the path** (API global prefix is `/api/v1`, health is at `/health`).
- **Prod env values:** `NODE_ENV=production`, `APP_URL=https://<DOMAIN>`, `COOKIE_SECURE=true`.
- **Node ≥ 20**, npm workspaces. All image builds use **build context = repo root** (monorepo-aware), mirroring `apps/api/Dockerfile`.
- The prod stack is invoked as `docker compose -f docker-compose.prod.yml <cmd>`. Compose auto-loads `.env`.
- **Local verification** (no VPS needed): `docker compose -f docker-compose.prod.yml config` validates the file; a local smoke run uses `DOMAIN=localhost` (Caddy issues an internal, self-signed cert automatically) and `curl -k https://localhost/...`.

---

## File Structure

```
friends-ai/
├─ docker-compose.prod.yml      # NEW — prod stack: caddy, api, postgres, redis, backup
├─ .env.prod.example            # NEW — documents every prod env key
├─ .dockerignore                # NEW — trims root build context (node_modules, dist, .git)
├─ .gitignore                   # MODIFY — re-include .env.prod.example
├─ infra/
│  ├─ Caddyfile                 # NEW — TLS + SPA static + reverse proxy
│  ├─ web/
│  │  └─ Dockerfile             # NEW — build SPA → Caddy image serving /srv
│  └─ backup/
│     ├─ Dockerfile             # NEW — postgres-client + mc + cron
│     ├─ backup.sh              # NEW — pg_dump | gzip → S3, prune old
│     └─ entrypoint.sh          # NEW — schedule cron OR run once
├─ docs/
│  └─ deployment.md             # NEW — deploy runbook
└─ README.md                    # MODIFY — add a "Deployment" pointer
```

Nothing under `apps/` changes. The API image (`apps/api/Dockerfile`) and `start:prod` are consumed as-is.

---

## Task 1: Production compose core (api + postgres + redis) + env template

Stands up the data-plane and API in a prod-shaped compose file with migrations-on-start, plus the documented env template. No proxy yet — the API is verified over the internal network via `docker compose exec`.

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `.env.prod.example`
- Modify: `.gitignore` (re-include `.env.prod.example`)

**Interfaces:**
- Consumes: `apps/api/Dockerfile` (existing), `apps/api` `start:prod` (existing), API env schema (`apps/api/src/config/env.schema.ts`).
- Produces: `docker-compose.prod.yml` with services `postgres`, `redis`, `api`; named volume `pgdata`; a shared logging anchor `x-logging`. `.env.prod.example` documenting every key consumed by later tasks (`DOMAIN`, S3, backup vars included).

- [ ] **Step 1: Re-include `.env.prod.example` in `.gitignore`**

The `.env.*` rule would otherwise ignore it. Edit `.gitignore` — under the `# env & secrets` block change:

```gitignore
# env & secrets
.env
.env.*
!.env.example
```

to:

```gitignore
# env & secrets
.env
.env.*
!.env.example
!.env.prod.example
```

- [ ] **Step 2: Write `.env.prod.example`**

Create `.env.prod.example` (documents every key across all tasks; extra keys are harmless to services that don't read them):

```dotenv
# ── Production environment (friends.ai) ─────────────────────────────────
# Copy to .env on the server and fill in real values. NEVER commit .env.
#   docker compose -f docker-compose.prod.yml up -d --build

# ── App / domain ──
NODE_ENV=production
PORT=3000
# Public domain (Caddy auto-TLS). Use "localhost" for a local smoke run.
DOMAIN=example.com
# Public base URL (email links, CORS). Must match DOMAIN over https.
APP_URL=https://example.com

# ── Auth / JWT ──
JWT_SECRET=CHANGE-ME-a-32-plus-character-random-secret
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000
# Refresh cookie requires HTTPS in prod — keep true.
COOKIE_SECURE=true

# ── Mail ──
MAIL_FROM=no-reply@example.com

# ── Captcha (Yandex SmartCaptcha) — optional until enabled ──
CAPTCHA_ENABLED=false
CAPTCHA_SECRET=

# ── PostgreSQL ──
POSTGRES_USER=friends
POSTGRES_PASSWORD=CHANGE-ME-strong-db-password
POSTGRES_DB=friends
DATABASE_URL=postgresql://friends:CHANGE-ME-strong-db-password@postgres:5432/friends

# ── Redis ──
REDIS_URL=redis://redis:6379

# ── Selectel S3 (object storage) ──
# Used by the backup service now; consumed by the API once the media module
# lands (FDM-6). For a local smoke run, point these at a throwaway MinIO.
S3_ENDPOINT=https://s3.storage.selcloud.ru
S3_REGION=ru-1
S3_BUCKET=friends-media
S3_ACCESS_KEY=CHANGE-ME
S3_SECRET_KEY=CHANGE-ME

# ── Backups (pg_dump → S3) ──
BACKUP_S3_BUCKET=friends-backups
BACKUP_CRON=0 3 * * *
BACKUP_RETENTION=7
```

- [ ] **Step 3: Write `docker-compose.prod.yml` (core services only)**

Create `docker-compose.prod.yml`:

```yaml
# Production stack. Bring up with:
#   docker compose -f docker-compose.prod.yml up -d --build
# Requires a .env file (see .env.prod.example). Only Caddy publishes ports
# (added in a later task); postgres/redis/api stay on the internal network.

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_ACCESS_TTL: ${JWT_ACCESS_TTL}
      JWT_REFRESH_TTL: ${JWT_REFRESH_TTL}
      COOKIE_SECURE: ${COOKIE_SECURE}
      APP_URL: ${APP_URL}
      MAIL_FROM: ${MAIL_FROM}
      CAPTCHA_ENABLED: ${CAPTCHA_ENABLED}
      CAPTCHA_SECRET: ${CAPTCHA_SECRET}
    restart: unless-stopped
    logging: *default-logging
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

volumes:
  pgdata:
```

- [ ] **Step 4: Validate the compose file (this is the "test")**

```bash
cp .env.prod.example .env
docker compose -f docker-compose.prod.yml config >/dev/null && echo "compose OK"
```

Expected: prints `compose OK` with no interpolation warnings (every `${VAR}` is present in `.env`).

- [ ] **Step 5: Bring the core stack up and verify migrations + health over the internal network**

```bash
docker compose -f docker-compose.prod.yml up -d --build
# Wait for the API to run `prisma migrate deploy` and boot, then hit /health
# from INSIDE the compose network (api publishes no host port):
sleep 20
docker compose -f docker-compose.prod.yml exec -T api wget -qO- http://localhost:3000/health
```

Expected: JSON containing `"status":"ok"` with `database` and `redis` reporting `up` (proves the API booted, migrations applied, and both backends are reachable).

- [ ] **Step 6: Confirm nothing but the intended ports are exposed, then tear down**

```bash
# api/postgres/redis must NOT be published to the host yet:
docker compose -f docker-compose.prod.yml ps --format '{{.Service}} {{.Ports}}'
docker compose -f docker-compose.prod.yml down
```

Expected: no host-side `0.0.0.0:*->*` mappings for `api`, `postgres`, `redis`.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.prod.yml .env.prod.example .gitignore
git commit -m "chore(infra): prod compose core (api+postgres+redis) + env template"
```

---

## Task 2: Caddy + SPA image (TLS, static serving, reverse proxy)

Adds the public edge: one Caddy image that serves the built SPA and reverse-proxies API/WebSocket/health traffic. After this task the whole app is reachable end-to-end over HTTPS locally.

**Files:**
- Create: `infra/Caddyfile`
- Create: `infra/web/Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.prod.yml` (add `caddy` service + `caddy_data`/`caddy_config` volumes)

**Interfaces:**
- Consumes: `apps/web` build (`npm run build -w @friends-ai/web` → `apps/web/dist`), `packages/contracts` (workspace dep of web), the `api` service (Task 1) on `api:3000`.
- Produces: `caddy` service (the only public service, ports `80`/`443`), reachable routes: `/` → SPA, `/api/*` + `/socket.io/*` + `/health` → `api:3000`.

- [ ] **Step 1: Add a root `.dockerignore` to trim the build context**

Create `.dockerignore` (repo root — applies to the root-context image builds):

```
**/node_modules
**/dist
.git
reference
docs
*.md
.env
.env.*
!.env.prod.example
```

- [ ] **Step 2: Write the Caddyfile**

Create `infra/Caddyfile`. `{$DOMAIN}` comes from the environment; `localhost` makes Caddy use its internal CA automatically, a real domain triggers Let's Encrypt. Matchers do **not** strip the path, so `/api/v1/...` reaches the API intact:

```
{$DOMAIN} {
	encode gzip
	header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"

	# API, realtime (Socket.IO), and the LB health probe → NestJS.
	@backend path /api/* /socket.io/* /health
	handle @backend {
		reverse_proxy api:3000
	}

	# Everything else is the SPA; unknown paths fall back to index.html.
	handle {
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
```

- [ ] **Step 3: Write the SPA→Caddy image**

Create `infra/web/Dockerfile` (build context = repo root; mirrors the API image's monorepo handling):

```dockerfile
# ---- builder: build the SPA ----
FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w @friends-ai/contracts \
 && npm run build -w @friends-ai/web

# ---- runtime: Caddy serving the static build ----
FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /repo/apps/web/dist /srv
```

- [ ] **Step 4: Add the `caddy` service to `docker-compose.prod.yml`**

The file now reads (full contents):

```yaml
# Production stack. Bring up with:
#   docker compose -f docker-compose.prod.yml up -d --build
# Requires a .env file (see .env.prod.example). Only Caddy publishes ports.

x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_ACCESS_TTL: ${JWT_ACCESS_TTL}
      JWT_REFRESH_TTL: ${JWT_REFRESH_TTL}
      COOKIE_SECURE: ${COOKIE_SECURE}
      APP_URL: ${APP_URL}
      MAIL_FROM: ${MAIL_FROM}
      CAPTCHA_ENABLED: ${CAPTCHA_ENABLED}
      CAPTCHA_SECRET: ${CAPTCHA_SECRET}
    restart: unless-stopped
    logging: *default-logging
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }

  caddy:
    build:
      context: .
      dockerfile: infra/web/Dockerfile
    environment:
      DOMAIN: ${DOMAIN}
    ports: ["80:80", "443:443"]
    restart: unless-stopped
    logging: *default-logging
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [api]

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

- [ ] **Step 5: Local end-to-end smoke over HTTPS (this is the "test")**

```bash
cp .env.prod.example .env
# Point the app at localhost so Caddy uses its internal CA, and give the
# API a matching public URL:
sed -i.bak 's|^DOMAIN=.*|DOMAIN=localhost|; s|^APP_URL=.*|APP_URL=https://localhost|' .env && rm -f .env.bak
docker compose -f docker-compose.prod.yml up -d --build
sleep 25
echo "--- health via Caddy (HTTPS) ---"
curl -fsSk https://localhost/health ; echo
echo "--- SPA index via Caddy ---"
curl -fsSk https://localhost/ | grep -qi '<div id="root"' && echo "SPA served OK"
```

Expected: `/health` returns `"status":"ok"` with `database`/`redis` `up` (proxied Caddy→api), and the SPA root HTML is served (`SPA served OK`). `-k` accepts Caddy's internal cert.

- [ ] **Step 6: Confirm only Caddy is published, then tear down**

```bash
docker compose -f docker-compose.prod.yml ps --format '{{.Service}} {{.Ports}}'
docker compose -f docker-compose.prod.yml down
```

Expected: only `caddy` shows `0.0.0.0:80->80` and `0.0.0.0:443->443`; `api`/`postgres`/`redis` show no host mappings.

- [ ] **Step 7: Commit**

```bash
git add infra/Caddyfile infra/web/Dockerfile .dockerignore docker-compose.prod.yml
git commit -m "feat(infra): Caddy edge — auto-TLS, SPA static, reverse proxy to api"
```

---

## Task 3: Nightly Postgres backups to S3

Adds a `backup` container that runs `pg_dump` on a cron schedule, uploads gzipped dumps to an S3-compatible bucket (Selectel in prod), and prunes to a retention window. Verified locally against a throwaway MinIO.

**Files:**
- Create: `infra/backup/Dockerfile`
- Create: `infra/backup/backup.sh`
- Create: `infra/backup/entrypoint.sh`
- Modify: `docker-compose.prod.yml` (add `backup` service)

**Interfaces:**
- Consumes: `postgres` service (Task 1) via libpq env (`PGHOST`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`); S3 env (`S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, backup bucket).
- Produces: `backup` service; `backup.sh` (one dump + prune); `entrypoint.sh` (cron loop, or `once` for on-demand runs).

- [ ] **Step 1: Write the backup script**

Create `infra/backup/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

TS="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="friends-${PGDATABASE}-${TS}.sql.gz"

mc alias set s3 "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" >/dev/null
echo "[backup] dumping ${PGDATABASE} -> s3/${S3_BUCKET}/backups/${FILE}"
pg_dump --no-owner --no-privileges | gzip -c | mc pipe "s3/${S3_BUCKET}/backups/${FILE}"
echo "[backup] upload complete"

# Retention: keep the newest ${BACKUP_RETENTION} dumps, delete the rest.
mc ls "s3/${S3_BUCKET}/backups/" | awk '{print $NF}' | grep '\.sql\.gz$' | sort -r \
  | tail -n +"$((BACKUP_RETENTION + 1))" \
  | while read -r old; do
      echo "[backup] pruning ${old}"
      mc rm "s3/${S3_BUCKET}/backups/${old}"
    done
```

- [ ] **Step 2: Write the entrypoint**

Create `infra/backup/entrypoint.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# On-demand: `docker compose run --rm backup once`
if [ "${1:-}" = "once" ]; then
  exec /usr/local/bin/backup.sh
fi

# Scheduled: install a crontab and run crond in the foreground.
echo "${BACKUP_CRON} /usr/local/bin/backup.sh >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "[backup] scheduled '${BACKUP_CRON}', retention ${BACKUP_RETENTION}"
exec crond -f -l 8
```

- [ ] **Step 3: Write the backup image**

Create `infra/backup/Dockerfile` (postgres 16 client matches the server; `mc` is the S3-compatible uploader):

```dockerfile
FROM postgres:16-alpine
RUN apk add --no-cache bash curl \
 && curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
 && chmod +x /usr/local/bin/mc
COPY backup.sh /usr/local/bin/backup.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

- [ ] **Step 4: Add the `backup` service to `docker-compose.prod.yml`**

Add this service (place it after `caddy`, before the top-level `volumes:` key):

```yaml
  backup:
    build:
      context: infra/backup
      dockerfile: Dockerfile
    environment:
      PGHOST: postgres
      PGUSER: ${POSTGRES_USER}
      PGPASSWORD: ${POSTGRES_PASSWORD}
      PGDATABASE: ${POSTGRES_DB}
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_BUCKET: ${BACKUP_S3_BUCKET:-${S3_BUCKET}}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      BACKUP_CRON: ${BACKUP_CRON:-0 3 * * *}
      BACKUP_RETENTION: ${BACKUP_RETENTION:-7}
    restart: unless-stopped
    logging: *default-logging
    depends_on:
      postgres: { condition: service_healthy }
```

- [ ] **Step 5: Verify a dump lands in S3, against a local MinIO (this is the "test")**

```bash
cp .env.prod.example .env
# Local S3 target = throwaway MinIO on the compose network's host:
docker run -d --name smoke-minio -p 9000:9000 \
  -e MINIO_ROOT_USER=smokekey -e MINIO_ROOT_PASSWORD=smokesecret123 \
  minio/minio server /data
sleep 5
docker run --rm --network host --entrypoint sh minio/mc -c \
  "mc alias set s3 http://localhost:9000 smokekey smokesecret123 && mc mb -p s3/friends-backups"

# Point backup env at the local MinIO (host.docker.internal reaches the host from the container):
sed -i.bak \
  -e 's|^S3_ENDPOINT=.*|S3_ENDPOINT=http://host.docker.internal:9000|' \
  -e 's|^S3_ACCESS_KEY=.*|S3_ACCESS_KEY=smokekey|' \
  -e 's|^S3_SECRET_KEY=.*|S3_SECRET_KEY=smokesecret123|' \
  -e 's|^BACKUP_S3_BUCKET=.*|BACKUP_S3_BUCKET=friends-backups|' .env && rm -f .env.bak

docker compose -f docker-compose.prod.yml up -d --build postgres
sleep 10
docker compose -f docker-compose.prod.yml run --rm \
  --add-host host.docker.internal:host-gateway backup once

echo "--- objects in bucket ---"
docker run --rm --network host --entrypoint sh minio/mc -c \
  "mc alias set s3 http://localhost:9000 smokekey smokesecret123 && mc ls s3/friends-backups/backups/"
```

Expected: the `backup once` run prints `upload complete`, and `mc ls` shows one `friends-friends-<timestamp>.sql.gz` object.

- [ ] **Step 6: Verify the dump restores into a fresh database, then tear down**

```bash
# Pull the dump back and restore it into a scratch DB inside the postgres container:
OBJ=$(docker run --rm --network host --entrypoint sh minio/mc -c \
  "mc alias set s3 http://localhost:9000 smokekey smokesecret123 >/dev/null && mc ls s3/friends-backups/backups/ | awk '{print \$NF}' | tail -1")
docker run --rm --network host --entrypoint sh minio/mc -c \
  "mc alias set s3 http://localhost:9000 smokekey smokesecret123 >/dev/null && mc cat s3/friends-backups/backups/$OBJ" \
  | gunzip -c | docker compose -f docker-compose.prod.yml exec -T postgres \
      sh -c 'createdb -U "$POSTGRES_USER" restore_test 2>/dev/null; psql -U "$POSTGRES_USER" -d restore_test' \
  && echo "restore OK"

docker compose -f docker-compose.prod.yml down
docker rm -f smoke-minio
git checkout .env.prod.example 2>/dev/null || true   # (only .env changed; .env is gitignored)
```

Expected: prints `restore OK` (the gzipped dump streams into a fresh `restore_test` DB without error).

- [ ] **Step 7: Commit**

```bash
git add infra/backup docker-compose.prod.yml
git commit -m "feat(infra): nightly pg_dump backups to S3 with retention + restore"
```

---

## Task 4: Deploy runbook + full-stack smoke + README pointer

Documents the end-to-end deploy for a real VPS and re-verifies the complete stack (all four services) locally as the closing gate.

**Files:**
- Create: `docs/deployment.md`
- Modify: `README.md` (add a short Deployment section linking the runbook)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: `docs/deployment.md` (provision → configure → deploy → verify → update → restore).

- [ ] **Step 1: Write the runbook**

Create `docs/deployment.md`:

```markdown
# Deployment runbook — friends.ai

Production runs as a Docker Compose stack (`docker-compose.prod.yml`). **Caddy** is the
only public service: it terminates TLS (auto Let's Encrypt), serves the built SPA, and
reverse-proxies `/api`, `/socket.io`, and `/health` to the NestJS API. Postgres, Redis,
and the backup job stay on the internal network.

## Prerequisites

- A Russian VPS (152-FZ), Docker + compose plugin installed, firewall allowing 22/80/443.
- A domain with an A-record pointing at the VPS IP.
- A Selectel S3 bucket + access keys (media, and DB backups).

## First deploy

1. `git clone <repo> && cd friends-ai`
2. `cp .env.prod.example .env` and fill in real values:
   - `DOMAIN` = your domain, `APP_URL=https://<DOMAIN>`, `COOKIE_SECURE=true`
   - a strong `JWT_SECRET` (≥32 chars) and `POSTGRES_PASSWORD` (update `DATABASE_URL` to match)
   - `S3_*` from Selectel; `BACKUP_S3_BUCKET` for DB dumps
3. `docker compose -f docker-compose.prod.yml up -d --build`
   - The API runs `prisma migrate deploy` on start, so migrations apply automatically.
4. Verify: `curl -fsS https://<DOMAIN>/health` → `"status":"ok"` with `database`/`redis` up.
   Open `https://<DOMAIN>/` and register a test account.

## Shipping a new version

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations run on API start. Zero-config: Caddy keeps its certs in the `caddy_data` volume.

## Backups

The `backup` service runs `pg_dump` on `BACKUP_CRON` (default nightly 03:00), uploads
`backups/friends-<db>-<ts>.sql.gz` to S3, and keeps the newest `BACKUP_RETENTION` dumps.

Run one on demand:

```bash
docker compose -f docker-compose.prod.yml run --rm backup once
```

Restore the latest dump into a scratch database:

```bash
mc alias set s3 "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
OBJ=$(mc ls "s3/$BACKUP_S3_BUCKET/backups/" | awk '{print $NF}' | tail -1)
mc cat "s3/$BACKUP_S3_BUCKET/backups/$OBJ" | gunzip -c \
  | docker compose -f docker-compose.prod.yml exec -T postgres \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

## Local smoke (no server needed)

```bash
cp .env.prod.example .env
sed -i '' 's|^DOMAIN=.*|DOMAIN=localhost|; s|^APP_URL=.*|APP_URL=https://localhost|' .env
docker compose -f docker-compose.prod.yml up -d --build
curl -k https://localhost/health
```

Caddy issues an internal self-signed cert for `localhost` (use `curl -k`).

## Logs & operations

- `docker compose -f docker-compose.prod.yml logs -f <service>` (json-file, rotated 10m×3).
- `docker compose -f docker-compose.prod.yml ps` — only `caddy` should publish ports.
```

- [ ] **Step 2: Add a Deployment pointer to `README.md`**

Append this section to `README.md`:

```markdown
## Deployment

Production runs as a Docker Compose stack behind Caddy (auto-TLS). See the
[deployment runbook](docs/deployment.md) for provisioning, first deploy,
updates, and DB backup/restore. Design rationale:
[spec](docs/superpowers/specs/2026-07-21-prod-deployment-design.md).
```

- [ ] **Step 3: Full-stack local smoke (this is the "test")**

```bash
cp .env.prod.example .env
sed -i.bak 's|^DOMAIN=.*|DOMAIN=localhost|; s|^APP_URL=.*|APP_URL=https://localhost|' .env && rm -f .env.bak
docker compose -f docker-compose.prod.yml config >/dev/null && echo "compose OK"
docker compose -f docker-compose.prod.yml up -d --build
sleep 25
curl -fsSk https://localhost/health | grep -q '"status":"ok"' && echo "health OK"
curl -fsSk https://localhost/ | grep -qi '<div id="root"' && echo "SPA OK"
docker compose -f docker-compose.prod.yml ps --format '{{.Service}} {{.Ports}}'
docker compose -f docker-compose.prod.yml down
```

Expected: `compose OK`, `health OK`, `SPA OK`; only `caddy` publishes `80`/`443`.

- [ ] **Step 4: Commit**

```bash
git add docs/deployment.md README.md
git commit -m "docs(infra): deployment runbook + README pointer"
```

---

## Self-Review

**1. Spec coverage** (against `2026-07-21-prod-deployment-design.md`):
- §2 Caddy auto-TLS, single domain, build-on-VPS, Selectel S3 → Tasks 2, 4 (and S3 in Task 3). ✅
- §3 topology (Caddy public; api/pg/redis internal) → Tasks 1–2, verified in Steps checking published ports. ✅
- §4.1 `docker-compose.prod.yml` (no minio, restart, log rotation, named volumes) → Task 1 + additions. ✅
- §4.2 `infra/web/Dockerfile` (SPA → Caddy image) → Task 2. ✅
- §4.3 `infra/Caddyfile` (routes, HSTS, gzip; localhost internal TLS) → Task 2. ✅
- §4.4 API reuse + migrations-on-release → Task 1 (Step 5 proves migrations ran). ✅
- §4.5 `backup` service (pg_dump → S3, retention) → Task 3. ✅
- §4.6 `.env.prod.example` (all keys) → Task 1. ✅
- §4.7 deploy runbook → Task 4. ✅
- §6 backups nightly + 7 retention → Task 3 (env defaults) + Task 4 (documented). ✅
- §7 log rotation (json-file 10m×3) → Task 1 anchor, applied to every service. ✅
- §8 local verification (`config` + `tls internal` smoke) → Tasks 1/2/4 verify steps. ✅
- §9 runbook outline → Task 4. ✅
- §10 out of scope (CD/GHCR, managed cloud, log aggregation) → not built. ✅
- §11 user-owned (provision, DNS, secrets) → documented in runbook, not automated. ✅

**2. Placeholder scan:** No TBD/TODO; every file and command is concrete. The only `CHANGE-ME` tokens are intentional placeholders **inside** `.env.prod.example` (a template), not plan gaps. ✅

**3. Type/name consistency:**
- Env var names match the API schema exactly (`JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `COOKIE_SECURE`, `APP_URL`, `MAIL_FROM`, `CAPTCHA_ENABLED`, `CAPTCHA_SECRET`, `DATABASE_URL`, `REDIS_URL`, `PORT`, `NODE_ENV`). ✅
- `DOMAIN` used identically in `.env.prod.example`, the `caddy` service env, and `infra/Caddyfile` (`{$DOMAIN}`). ✅
- Backup S3 vars (`S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`BACKUP_S3_BUCKET`/`BACKUP_CRON`/`BACKUP_RETENTION`) match across `.env.prod.example`, the `backup` service, `entrypoint.sh`, and `backup.sh`. ✅
- SPA API base path `/api/v1` (from `apps/web`) is covered by the Caddyfile `/api/*` matcher, unstripped. ✅
- `start:prod` = `prisma migrate deploy && node dist/src/main.js` (verified in `apps/api/package.json`); API image `CMD ["npm","run","start:prod"]`. ✅

---

## Execution Handoff

*(Filled in after the plan is reviewed and an execution mode is chosen.)*
