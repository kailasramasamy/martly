---
globs: apps/api/**
---

# API Conventions (Fastify 5 + Prisma 6)

## Structure

- Routes in `src/routes/<resource>/index.ts`, registered in `src/app.ts` under `/api/v1/` prefix
- Auth: `{ preHandler: [authenticate] }`, optional: `[app.authenticateOptional]`, role-restricted: `[authenticate, requireRole("ROLE")]`

## Org Scoping (Critical)

Always use helpers from `src/middleware/org-scope.ts`:
- `getOrgUser(request)` — typed user payload with `{ sub, role, organizationId? }`
- `getOrgStoreIds(request, prisma)` — store IDs for filtering (undefined = SUPER_ADMIN sees all)
- `verifyStoreOrgAccess(request, prisma, storeId)` — verify access before operating on a store
- **Every query involving org-scoped data MUST filter by organizationId**

## Patterns

- Response types: `ApiResponse<T>` (single), `PaginatedResponse<T>` (list with meta)
- Validation: Zod schemas from `@martly/shared/schemas`, custom errors via `throw Object.assign(new Error("msg"), { statusCode: 400 })`
- Error replies: `reply.badRequest()`, `reply.notFound()`, `reply.forbidden()`
- Use `app.prisma.$transaction()` for multi-step mutations
- Pagination: `skip = (page - 1) * pageSize`, `take = pageSize`
- Search: `contains` with `mode: "insensitive"`
