# Martly

Multi-tenant grocery/FMCG platform — admin panel, REST API, and mobile customer app.

## Architecture

Monorepo with **pnpm workspaces** + **Turbo v2**.

```
apps/
  admin/     → React 19 + Vite + Refine + Ant Design 5 (port 7000)
  api/       → Fastify 5 + Prisma 6 + PostgreSQL (port 7001)
  mobile/    → React Native + Expo 54 + Expo Router (port 8081)
packages/
  shared/    → Zod schemas, TypeScript types, enums
```

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start all apps |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm --filter @martly/admin dev` | Start admin only |
| `pnpm --filter @martly/api dev` | Start API only |
| `pnpm --filter @martly/mobile dev` | Start mobile only |

## Multi-Tenancy

All data is org-scoped. Roles:

- **SUPER_ADMIN** — Full access, no org filter
- **ORG_ADMIN** — All stores within their organization
- **STORE_MANAGER / STAFF** — Only assigned stores (via `UserStore`)
- **CUSTOMER** — No org context needed

## Test Users

| Email | Password | Role |
|-------|----------|------|
| `admin@martly.dev` | `admin123` | SUPER_ADMIN |
| `owner@innovative.dev` | `owner123` | ORG_ADMIN (Innovative Foods) |
| `manager@bigmart.dev` | `manager123` | STORE_MANAGER (Bigmart) |
| `customer@martly.dev` | `customer123` | CUSTOMER |

OTP login: any 10-digit phone, OTP is `123456`.

## Key Paths

| What | Path |
|------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| API entry + route registration | `apps/api/src/app.ts` |
| API routes | `apps/api/src/routes/*/index.ts` |
| Auth middleware | `apps/api/src/middleware/auth.ts` |
| Org-scope middleware | `apps/api/src/middleware/org-scope.ts` |
| Shared schemas | `packages/shared/src/schemas/index.ts` |
| Shared constants/enums | `packages/shared/src/constants/index.ts` |
| Admin app entry | `apps/admin/src/App.tsx` |
| Admin pages | `apps/admin/src/pages/*/` |
| Admin data provider | `apps/admin/src/providers/data-provider.ts` |
| Mobile app layout | `apps/mobile/app/_layout.tsx` |
| Mobile API helper | `apps/mobile/lib/api.ts` |
| Store context | `apps/mobile/lib/store-context.tsx` |
| Auth context | `apps/mobile/lib/auth-context.tsx` |
| Mobile types | `apps/mobile/lib/types.ts` |
