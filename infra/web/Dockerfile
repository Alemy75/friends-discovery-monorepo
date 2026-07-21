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
