---
globs: "**/prisma/**"
---

# Database Conventions (Prisma 6 + PostgreSQL)

## Schema Patterns

```prisma
model ModelName {
  id             String   @id @default(uuid())
  organizationId String   @map("organization_id")
  name           String
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id])

  @@map("model_names")
}
```

### Conventions

| Pattern | Convention |
|---------|-----------|
| Primary keys | `@id @default(uuid())` |
| Timestamps | `createdAt @default(now()) @map("created_at")`, `updatedAt @updatedAt @map("updated_at")` |
| Table names | `@@map("snake_case_plural")` |
| Column names | `@map("snake_case")` for multi-word fields |
| Org-scoped models | Must have `organizationId` with relation to `Organization` |
| Unique constraints | `@@unique([field1, field2])` for composite keys |
| Decimal fields | Use `Decimal` type for money (not Float) |
| Optional relations | `String?` for nullable foreign keys |

## Enums

Define as Prisma enums, mirror in `packages/shared/src/constants/index.ts`:
```prisma
enum MyStatus {
  ACTIVE
  INACTIVE
}
```

Existing enums: `UserRole`, `StoreStatus`, `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `FulfillmentType`, `UnitType`, `FoodType`, `ProductType`, `StorageType`, `DiscountType`, `CouponType`, `WalletTransactionType`, `LoyaltyTransactionType`

## Migrations

Run from `apps/api/` directory (where `.env` with `DATABASE_URL` lives):
```bash
cd apps/api && npx prisma migrate dev --name descriptive_name
```

After schema changes, always:
1. `pnpm db:generate` — Regenerate Prisma client
2. `pnpm db:migrate` — Apply migration

## Seed Files

Seed scripts live in `apps/api/prisma/seed-*.ts`. Run with:
```bash
cd apps/api && npx tsx prisma/seed-feature.ts
```

## Product Architecture

Two-tier catalog:
- **Master catalog**: `product.organizationId = null` (global)
- **Org-specific**: `product.organizationId` set
- **Store products**: `store_products` join table links products to stores with per-store price, stock, `isActive`, `isFeatured`, discount fields
