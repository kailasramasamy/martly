# Martly

Martly is a multi-tenant grocery/FMCG store management platform with a web admin panel, REST API, and mobile customer app.

## Architecture

Monorepo managed with **pnpm workspaces** + **Turbo v2**.

```
apps/
  admin/     → React 19 + Vite + Refine + Ant Design 5 (port 7000)
  api/       → Fastify 5 + Prisma 6 + PostgreSQL (port 7001)
  mobile/    → React Native + Expo 54 + Expo Router (port 8081)
packages/
  shared/    → Zod schemas, TypeScript types, enums
```

## Quick Start

```bash
pnpm install
pnpm db:generate        # Generate Prisma client
pnpm db:migrate         # Run migrations
pnpm db:seed            # Seed demo data
pnpm dev                # Start all apps
```

## Common Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start all apps (admin, api, mobile) |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:seed-catalog` | Seed product catalog |
| `pnpm db:seed-master-catalog` | AI-generated master catalog |
| `pnpm --filter @martly/admin dev` | Start admin only |
| `pnpm --filter @martly/api dev` | Start API only |
| `pnpm --filter @martly/mobile dev` | Start mobile only |

## Multi-Tenancy Model

All data is scoped by organization. Key roles:

- **SUPER_ADMIN** — Full access, no org filter
- **ORG_ADMIN** — All stores within their organization
- **STORE_MANAGER / STAFF** — Only assigned stores (via `UserStore` join table)
- **CUSTOMER** — No org context needed

## Test Users

| Email | Password | Role |
|-------|----------|------|
| `admin@martly.dev` | `admin123` | SUPER_ADMIN |
| `owner@innovative.dev` | `owner123` | ORG_ADMIN (Innovative Foods) |
| `manager@bigmart.dev` | `manager123` | STORE_MANAGER (Bigmart) |
| `customer@martly.dev` | `customer123` | CUSTOMER |

## Product Architecture

Two-tier catalog system:

- **Master catalog** — Global products (`product.organizationId = null`)
- **Org-specific products** — Products created by an org (`product.organizationId` set)
- **Store products** — Mapping table linking products to stores with per-store price, stock, `isActive`, `isFeatured`, and discount fields

The `store_products` table bridges products to stores. Both master and org-specific products go through it.

## API Conventions (`apps/api/`)

### Route structure
Routes live in `src/routes/<resource>/index.ts` and export `async function (app: FastifyInstance)`.
Registered in `src/app.ts` with `app.register(module, { prefix: '/api/v1/<resource>' })`.

### Authentication
- `{ preHandler: [app.authenticate] }` — Require JWT
- `{ preHandler: [app.authenticateOptional] }` — Allow guest access
- Use `getOrgUser(request)` from `src/middleware/org-scope.ts` to get typed user payload

### Org scoping
- `orgScopedStoreFilter(request)` — Returns Prisma `where` clause for stores
- `getOrgStoreIds(request)` — Returns array of accessible store IDs (or `undefined` for SUPER_ADMIN)
- `verifyStoreOrgAccess(request, storeId)` — Throws if user can't access the store
- Always filter queries by `organizationId` for multi-tenant safety

### Validation
- Request bodies validated with Zod schemas from `@martly/shared`
- Global error handler formats `ZodError` into readable field-level messages

## Admin Panel Conventions (`apps/admin/`)

- **Framework**: Refine with Ant Design
- **Routing**: React Router 7
- **Data fetching**: `@refinedev/simple-rest` pointing at the API
- **Hooks**: `useTable`, `useForm`, `useShow` from `@refinedev/antd`
- **Theme**: Teal/emerald brand colors (`#0d9488`), supports dark mode (persisted in `localStorage` key `martly_theme`)
- Resources registered in `App.tsx` with `name`, route paths, and `meta` (label, icon, parent for sidebar grouping)

### Admin navigation
- No separate "Store Products" sidebar item
- Products page has tabs: All Products, Mapped Products, Store Products, Master Catalog
- Mapped Products = master catalog products assigned to a store
- Store Products = org-specific products

## Mobile App Conventions (`apps/mobile/`)

- **Navigation**: Expo Router (file-based)
- **Auth**: JWT stored in `expo-secure-store`
- **State**: `StoreProvider` context for selected store, `CartProvider` for cart
- **API calls**: `fetch` with Bearer token from SecureStore
- **Tabs**: Home (featured products), Categories, Orders, Profile
- **Push notifications**: Firebase via Expo Notifications, handles `ORDER_STATUS_UPDATE` deep links

## Database Conventions (Prisma)

- Primary keys: `@id @default(uuid())`
- Timestamps: `createdAt @default(now()) @map("created_at")`, `updatedAt @updatedAt @map("updated_at")`
- Table names: `@@map("snake_case_table")`
- Column names: `@map("snake_case_column")`
- Org-scoped models must have `organizationId` with relation to `Organization`
- Enums: `UserRole`, `StoreStatus`, `OrderStatus`, `PaymentStatus`, `UnitType`, `FoodType`, `ProductType`, `StorageType`, `DiscountType`

## Code Quality

- Every fix must be production-ready — no workarounds, hacks, or temporary patches. If a problem requires API changes, schema changes, or restructuring across apps, do that. Don't paper over issues on the client when the proper fix belongs on the server (or vice versa).
- Free to change APIs, admin, and mobile app as needed to get the right solution. Cross-cutting changes are expected and preferred over fragile single-layer workarounds.

## Key File Paths

| What | Path |
|------|------|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| API entry point | `apps/api/src/app.ts` |
| Auth middleware | `apps/api/src/middleware/auth.ts` |
| Org scope middleware | `apps/api/src/middleware/org-scope.ts` |
| API routes | `apps/api/src/routes/*/index.ts` |
| Shared schemas | `packages/shared/src/schemas/index.ts` |
| Admin app entry | `apps/admin/src/App.tsx` |
| Admin pages | `apps/admin/src/pages/*/` |
| Mobile app layout | `apps/mobile/app/_layout.tsx` |
| Mobile tabs layout | `apps/mobile/app/(tabs)/_layout.tsx` |
| Store context | `apps/mobile/lib/store-context.tsx` |
| Mobile types | `apps/mobile/lib/types.ts` |
