---
globs: "**/prisma/**"
---

# Database Conventions (Prisma 6 + PostgreSQL)

## Schema

- UUIDs for PKs, `@map("snake_case")` for multi-word fields, `@@map("snake_case_plural")` for tables
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt`
- Money: `Decimal` type (not Float). Org-scoped models must have `organizationId`
- Enums: define in Prisma, mirror in `packages/shared/src/constants/index.ts`

## Commands

- Migrations from `apps/api/` dir: `cd apps/api && npx prisma migrate dev --name descriptive_name`
- After schema changes: `pnpm db:generate` then `pnpm db:migrate`
- Seed scripts: `apps/api/prisma/seed-*.ts`, run with `cd apps/api && npx tsx prisma/seed-feature.ts`

## Product Architecture

Two-tier catalog: master (`organizationId = null`) + org-specific. `store_products` join table links to stores with per-store price, stock, discount fields.
