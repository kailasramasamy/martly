---
globs: apps/api/**
---

# API Conventions (Fastify 5 + Prisma 6)

## Route Structure

Routes live in `src/routes/<resource>/index.ts` and export a named async function:

```ts
import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";

export async function resourceRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => { ... });
}
```

Register in `src/app.ts`:
```ts
import { resourceRoutes } from "./routes/resource/index.js";
await api.register(resourceRoutes, { prefix: "/resource" });
```

All routes are under `/api/v1/` prefix (applied in app.ts).

## Authentication

- `{ preHandler: [authenticate] }` — Require valid JWT
- `{ preHandler: [app.authenticateOptional] }` — Allow guest access
- `{ preHandler: [authenticate, requireRole("ORG_ADMIN", "SUPER_ADMIN")] }` — Role-restricted

## Org Scoping (Critical for Multi-Tenancy)

Always use these helpers from `src/middleware/org-scope.ts`:

| Function | Returns | Use When |
|----------|---------|----------|
| `getOrgUser(request)` | `{ sub, email, role, organizationId? }` | Always — get typed user payload |
| `getOrgStoreIds(request, prisma)` | `string[]` or `undefined` | Filtering store lists (undefined = SUPER_ADMIN sees all) |
| `verifyStoreOrgAccess(request, prisma, storeId)` | `boolean` | Before operating on a specific store |
| `orgScopedStoreFilter(request)` | Prisma `where` clause | Filtering stores in queries |

**Every query involving org-scoped data MUST filter by organizationId.** SUPER_ADMIN bypasses org filter.

## Response Patterns

```ts
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";

// Single item
return { success: true, data: result } satisfies ApiResponse<typeof result>;

// Paginated list
return {
  success: true,
  data: items,
  meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / pageSize) },
} satisfies PaginatedResponse<typeof items[0]>;
```

## Validation

- Parse request bodies with Zod schemas from `@martly/shared/schemas`
- Global error handler auto-formats `ZodError` into field-level messages
- For custom errors: `throw Object.assign(new Error("message"), { statusCode: 400 })`
- Use Fastify's `reply.badRequest()`, `reply.notFound()`, `reply.forbidden()`, `reply.unauthorized()`

## Prisma Transactions

Use `app.prisma.$transaction()` for multi-step mutations (e.g., order creation with stock/wallet/loyalty):
```ts
const result = await app.prisma.$transaction(async (tx) => {
  const item = await tx.model.update({ ... });
  await tx.otherModel.create({ ... });
  return item;
});
```

## Common Patterns

- Query params typed via `request.query as { field?: string }`
- Path params via route generics: `app.get<{ Params: { id: string } }>("/:id", ...)`
- Search: use `contains` with `mode: "insensitive"` for text search
- Pagination: `skip = (page - 1) * pageSize`, `take = pageSize`
- Sorting: `orderBy: { [sortBy]: sortOrder }` from query params
