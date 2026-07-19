# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache openssl
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
RUN apk add --no-cache openssl
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
