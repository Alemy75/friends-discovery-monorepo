# friends.ai — production deployment (design)

**Date:** 2026-07-21
**Status:** approved, ready for implementation plan
**Task:** [FDM-15](https://github.com/Alemy75/friends-discovery-monorepo/issues/15)
**Author:** Max + Claude (brainstorming)
**Builds on:** [2026-07-19-backend-architecture-design.md](2026-07-19-backend-architecture-design.md) — §2.1 Hosting, §3.1 Deployment topology, §10 Operations, §12 Open questions

## 1. Context & goal

The local foundation is already in `main` (backend foundation): the monorepo, `apps/api`
(NestJS), a local `docker-compose.yml` (postgres/redis/minio/api), `apps/api/Dockerfile`,
`.env.example`, and CI. What remains — and what this design covers — is **standing up the
production environment**: everything needed to deploy the app (SPA + API) to a fresh
Docker-capable Russian VPS, reproducibly, over TLS, with migrations on release and backups.

**Goal of this slice:** the repository contains all artifacts to deploy to a fresh VPS via a
documented runbook. Provisioning the VPS/S3, DNS, and real secrets are user-owned steps
executed by following that runbook — not automated here.

**Note on language:** this spec (and the implementation plan/code it feeds) is written in
English, matching the existing implementation plans and the now-English FDM-15 issue.

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| TLS / reverse proxy | **Caddy** (single container, auto-TLS) | Auto issue/renew Let's Encrypt with no cron; serves SPA static + proxies `/api` and WSS. Minimal config. Same role the spec assigns to "Nginx" (§3.1). |
| Media storage (prod) | **Selectel S3** from day one | Per §2.1 ("MinIO local → Selectel S3 in prod"); no MinIO container in prod compose. API reaches S3 via env. |
| Domain layout | **Single domain** | SPA on `/`, API on `/api/v1`, sockets on `/socket.io`. Same origin ⇒ auth httpOnly-cookie and CORS (locked to SPA origin, §7) are trivially satisfied. |
| Build/deploy | **Build on the VPS** via `docker compose --build` | No registry/account needed. CI-built images → GHCR and CD automation are out of scope (§11), a later task. |

## 3. Production topology

```
Internet ──443 HTTPS/WSS (80→443 redirect)──► [Caddy]  (auto-TLS; ONLY public port)
                                                 ├─ /api/*        → api:3000
                                                 ├─ /socket.io/*  → api:3000 (WSS upgrade — chat)
                                                 └─ /*            → SPA static (fallback → index.html)
                                                      │  (internal docker network; nothing else published)
                                                 [api] (NestJS) ─► [postgres] (named volume)
                                                      │           └► [redis]
                                                      └─────────► Selectel S3 (external, via env)
                                                 [backup] ─ cron: pg_dump → Selectel S3
```

Provider-agnostic: runs on any Docker-capable VPS.

## 4. Artifacts (what gets added)

1. **`docker-compose.prod.yml`** — services `caddy`, `api`, `postgres`, `redis`, `backup`.
   No `minio`. Only Caddy publishes ports (`80`, `443`); postgres/redis/api stay on the
   internal network. `restart: unless-stopped` on all. Named volumes: `pgdata`, `caddy_data`,
   `caddy_config`. Per-service log config: json-file driver with `max-size`/`max-file` (rotation).
   `api` uses `depends_on` health conditions for postgres/redis (as in the local compose).

2. **`infra/web/Dockerfile`** — multi-stage: build the SPA (`apps/web`) → final image
   `FROM caddy:2-alpine` with the built assets in `/srv`. Caddy = SPA static serving +
   reverse proxy in one image. Build context = repo root (monorepo-aware, like the API image).

3. **`infra/Caddyfile`** — site block for `{$DOMAIN}`: auto-TLS, `encode gzip`, HSTS header,
   `handle_path /api/*` and `/socket.io/*` → `reverse_proxy api:3000` (with WebSocket upgrade),
   and a SPA `try_files {path} /index.html` fallback for everything else. A `{$TLS_MODE}`
   knob lets local smoke-tests use `tls internal` (see §8).

4. **API deploy** — reuse the existing `apps/api/Dockerfile` and `start:prod`
   (`prisma migrate deploy && node dist/src/main.js`): **migrations apply on release, before
   the API starts serving**. No new API code required for deployment.

5. **`backup` service** — a lightweight container running cron: `pg_dump` of the Postgres
   service piped to a Selectel S3 bucket on a schedule (e.g. nightly), with a retention window.
   Restore procedure documented in the runbook. (Media in S3 is Selectel-managed; DB is the
   thing we back up here.)

6. **`.env.prod.example`** — documents every prod key: `DOMAIN`, `POSTGRES_USER/PASSWORD/DB`,
   `DATABASE_URL`, `REDIS_URL`, S3 (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
   `S3_REGION`), JWT/auth secrets, backup schedule/retention. The real `.env` lives only on the
   server and is gitignored.

7. **Deploy runbook** — `docs/deployment.md`: provision VPS (install Docker) → point DNS
   A-record at the VPS → clone repo → create `.env` from `.env.prod.example` → bring up S3 +
   secrets → `docker compose -f docker-compose.prod.yml up -d --build` → verify
   `https://<domain>/health`. Update flow: `git pull && docker compose -f docker-compose.prod.yml
   up -d --build`. Includes the backup-restore procedure.

## 5. Env & secrets

Config is already validated at boot by the API (zod, §backend-foundation). Prod adds S3 and
domain keys. Secrets never enter git: `.env` is gitignored, `.env.prod.example` is the
documented template. Same-origin layout means no extra CORS origin to configure beyond the
SPA origin the API already locks to (§7 of the architecture spec).

## 6. Backups

Nightly `pg_dump` → Selectel S3, run by the `backup` container's cron. Default cadence:
nightly, retain the last 7 daily dumps (adjustable via env).
The runbook documents a verified restore (download latest dump → `pg_restore`/`psql` into a
fresh database). Media objects live in Selectel S3 and rely on Selectel durability; media
backup/versioning is out of scope for this slice.

## 7. Logging

The API already logs structurally (pino, no PII — architecture spec §10). In prod we rely on
Docker's json-file log driver with `max-size`/`max-file` rotation configured per service in
compose; `docker compose logs` is the access path. Centralized log aggregation is out of scope.

## 8. Local verification (no live VPS required)

Two checks make the artifacts verifiable before any server exists:

1. **Static validation:** `docker compose -f docker-compose.prod.yml config` parses/validates
   the compose file.
2. **Local smoke run:** bring the full prod stack up locally with `DOMAIN=localhost` and
   `TLS_MODE=internal` (Caddy issues an internal self-signed cert), then hit
   `https://localhost/health` and confirm `database` + `redis` are `up`, and that the SPA
   is served at `/`. This exercises the real Caddy routing, the API image, migrations-on-start,
   and postgres/redis wiring end-to-end without real certs, DNS, or S3 (S3 can point at a
   throwaway/local endpoint for the smoke run).

## 9. Deploy runbook (outline)

1. Provision a Russian VPS (152-FZ); install Docker + compose plugin; basic firewall (allow 22/80/443).
2. Create a Selectel S3 bucket + access keys.
3. Point the domain's A-record at the VPS IP.
4. `git clone` the repo; `cp .env.prod.example .env`; fill in secrets, `DOMAIN`, S3 keys.
5. `docker compose -f docker-compose.prod.yml up -d --build`.
6. Verify `https://<domain>/health` is green; register/login smoke; confirm a nightly backup lands in S3.
7. **Updates:** `git pull && docker compose -f docker-compose.prod.yml up -d --build`.

## 10. Out of scope (later tasks)

- CI-built images → GHCR and CD automation (§11) — separate task.
- Managed cloud, per-city sharding, read replicas (§11).
- Centralized log aggregation / metrics / alerting.
- Media backup/versioning beyond Selectel durability.
- Multi-node / load-balanced API (Redis Socket.IO adapter is already wired for it — architecture spec §6).

## 11. User-owned steps (not automated)

Choosing/provisioning the Selectel VPS and S3, registering the domain and DNS, and placing
real secrets in the server `.env` — performed by the user following the runbook.

## 12. Open questions

- Exact Selectel VPS size and S3 bucket/region — decided at provisioning time (§12 of the
  architecture spec). Budget target ~1.5–3k ₽/month.
- Backup cadence/retention default to nightly + 7 daily dumps (§6); revisit if storage/RPO needs change.
