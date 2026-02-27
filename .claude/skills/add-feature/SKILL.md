---
name: add-feature
description: Plan and implement a full-stack feature across the Martly API, admin panel, and/or mobile app
argument-hint: <feature description>
---

Plan and implement a full-stack feature for the Martly project.

**Feature:** $ARGUMENTS

## Process

### 1. Analyze the Feature
- Break down the feature into backend (API), frontend (admin), and mobile components
- Identify which layers are affected
- Check if schema changes are needed

### 2. Database Layer (if needed)
- Update `apps/api/prisma/schema.prisma` with new models/fields
- Run `pnpm db:generate` and `pnpm db:migrate`
- Follow conventions: uuid PKs, snake_case mapping, org-scoped with `organizationId`

### 3. Shared Schemas (if needed)
- Add/update Zod validation schemas in `packages/shared/src/schemas/index.ts`
- Export types for use across apps

### 4. API Routes
- Create/update route handlers in `apps/api/src/routes/`
- Follow patterns: Fastify handlers, `app.authenticate` preHandler, `getOrgUser()` for org scoping
- Register new routes in `apps/api/src/app.ts`
- Reference: `apps/api/src/routes/products/index.ts`

### 5. Admin Panel (if needed)
- Create/update pages in `apps/admin/src/pages/`
- Use Refine hooks (`useTable`, `useForm`, `useShow`) + Ant Design components
- Register resources and routes in `apps/admin/src/App.tsx`
- Reference: `apps/admin/src/pages/products/list.tsx`

### 6. Mobile App (if needed)
- Create/update screens in `apps/mobile/app/`
- Use Expo Router for navigation, SecureStore for auth tokens
- Use store context from `apps/mobile/lib/store-context.tsx`
- Reference: `apps/mobile/app/(tabs)/index.tsx`

## Key Files to Reference
| Layer | Key Files |
|-------|-----------|
| Schema | `apps/api/prisma/schema.prisma` |
| Shared | `packages/shared/src/schemas/index.ts` |
| API app | `apps/api/src/app.ts` |
| API routes | `apps/api/src/routes/*/index.ts` |
| API middleware | `apps/api/src/middleware/auth.ts`, `org-scope.ts` |
| Admin app | `apps/admin/src/App.tsx` |
| Admin pages | `apps/admin/src/pages/*/` |
| Mobile app | `apps/mobile/app/_layout.tsx` |
| Mobile tabs | `apps/mobile/app/(tabs)/_layout.tsx` |
| Mobile lib | `apps/mobile/lib/store-context.tsx`, `types.ts` |

## Checklist
- [ ] Schema changes applied and migrated
- [ ] Zod schemas updated in shared package
- [ ] API endpoints created/updated with proper auth and org-scoping
- [ ] Admin pages created/updated with Refine patterns
- [ ] Mobile screens created/updated (if applicable)
- [ ] Tested via admin panel and/or curl
