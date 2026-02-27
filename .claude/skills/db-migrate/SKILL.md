---
name: db-migrate
description: Create a new Prisma database migration for the Martly project — update schema, generate client, and run migration
argument-hint: <description of schema change>
---

Create a new Prisma migration for the Martly database.

**What to change:** $ARGUMENTS

## Steps

1. **Read the current schema** at `apps/api/prisma/schema.prisma` to understand existing models and relationships.

2. **Edit the Prisma schema** to make the requested changes. Follow these conventions:
   - Use `@id @default(uuid())` for primary keys
   - Use `@default(now())` for `createdAt` and `@updatedAt` for `updatedAt`
   - Use proper relations with `@relation` and foreign key fields
   - Add `@@map("table_name")` for snake_case table names
   - Add `@map("column_name")` for snake_case column names
   - Use enums defined in the schema for constrained values
   - Always consider multi-tenancy: add `organizationId` field where entities are org-scoped

3. **Generate the Prisma client:**
   ```bash
   pnpm db:generate
   ```

4. **Create and apply the migration:**
   ```bash
   pnpm db:migrate
   ```
   When prompted, provide a descriptive migration name in snake_case (e.g., `add_loyalty_points_to_users`).

5. **Update shared types** if needed — Add or update Zod schemas in `packages/shared/src/schemas/index.ts`.

6. **Update API routes** if needed — Modify relevant route handlers in `apps/api/src/routes/` to use new fields/models.

## Key Schema Patterns

```prisma
model NewModel {
  id              String       @id @default(uuid())
  name            String
  organizationId  String       @map("organization_id")
  organization    Organization @relation(fields: [organizationId], references: [id])
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  @@map("new_models")
}
```

Remember to add the reverse relation field to the related model (e.g., add `newModels NewModel[]` to the `Organization` model).
