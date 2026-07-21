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
