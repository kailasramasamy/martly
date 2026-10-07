# Martly API — Railway service "api" (default Dockerfile)
# Type-checks at build time and runs the TypeScript source with tsx (the workspace's
# @martly/shared package ships as TS source), applying Prisma migrations on start.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat \
  && corepack enable && corepack prepare pnpm@10.29.3 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY apps/rider/package.json apps/rider/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@martly/api..."

FROM deps AS runner
ENV NODE_ENV=production
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @martly/api exec prisma generate \
  && pnpm --filter @martly/api build
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
EXPOSE 7001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
