# Mobile Manage persona

Store owners and managers run their stores from the Martly app. Which persona a user gets depends on their role.

## Personas

| Role | Lands on | Can switch? |
|---|---|---|
| CUSTOMER | Shop `(tabs)` | No |
| SUPER_ADMIN, ORG_ADMIN, STORE_MANAGER | Manage `(manage)` | Yes. "Switch to shopping" in Manage › More, and "Manage my store" in Shop › Account |
| STAFF, RIDER | `unsupported-role` (directs them to the web admin) | No |

- The last persona chosen is saved in AsyncStorage (`martly_persona`) and survives relaunch.
- `lib/persona-context.tsx` resolves the persona for each signed-in user. Root redirects in `app/_layout.tsx` wait for `isReady`, so the screen never flashes the wrong persona.

## Sign-in flows

- **Phone OTP (existing):** customers, plus any staff user whose phone number is on file.
- **Staff login:** `app/(auth)/staff-login.tsx` uses email and password and calls `POST /auth/login`.
- **Several orgs:** if the user belongs to more than one org, both flows return `requiresOrgSelection`. The app then opens `app/(auth)/select-org.tsx`, which calls `POST /auth/select-org` with the temporary token. `lib/org-selection.ts#completeLogin` handles this branching.

## Store scope

`lib/manage-scope-context.tsx` loads `GET /stores` (already org-scoped by the API) and keeps track of the selected store.

| Role | Options in the store switcher |
|---|---|
| ORG_ADMIN, SUPER_ADMIN | Each store, plus "All stores" |
| STORE_MANAGER | Their assigned stores only |

- The selection is saved under `martly_manage_store`.
- The ink header (`components/manage/ManageHeader.tsx`) opens the switcher. When there is more than one org, the switcher groups stores by org.

## Permissions

`@martly/shared/permissions` is the single role-to-resource matrix, used by both the web admin (`access-control.ts`) and the mobile More menu (`components/manage/modules.ts`).

- Unlike the old admin fallthrough, STAFF and RIDER no longer get write access to stores or featured products.
- Order transitions now live in `@martly/shared/order-flow`.

## API changes (M0)

- **`verify-otp`:**
  - Multi-org staff now get `requiresOrgSelection` instead of a token with no org.
  - Staff with no org get a 403, the same as `/login`.
- **`org-scope.ts`, multi-tenancy fix:**
  - `getOrgStoreIds` and `verifyStoreOrgAccess` now only count a STORE_MANAGER/STAFF/RIDER store assignment if the store belongs to the org in the token.
  - Previously, a multi-org manager could see stores from another org.
- **`GET /stores`:** each store now includes `organizationName`.

## Test accounts

Created by `cd apps/api && npx tsx prisma/seed-manage-users.ts`.

| Email | Password | Role | Expected landing |
|---|---|---|---|
| owner@demogrocers.dev | owner123 | ORG_ADMIN, all 9 Demo Grocers stores | Manage, "All stores" |
| manager@harur.dev | manager123 | STORE_MANAGER, Harur Fresh Mart | Manage, Harur Fresh Mart |
| staff@harur.dev | staff123 | STAFF | Unsupported-role screen |
| multi@martly.dev | multi123 | STORE_MANAGER, Demo Grocers + Martly QA | Org picker |

The seed also creates the `Martly QA` org and a PENDING `QA Test Store`. Because it is PENDING, customers never see it.

## Tested (M0)

- `/auth/login` for all four accounts, plus a wrong password, which returns 401.
- `select-org` → `/me` → `/stores` for the multi-org user. Only the selected org's store comes back; this was the bug fixed above.
- `/stores` scoping: ORG_ADMIN gets 9 stores and the manager gets 1.
- `verify-otp`:
  - A multi-org staff phone returns `requiresOrgSelection`. Tested with a DB-seeded OTP, so no SMS was sent.
  - The customer review phone is unchanged.
- Typecheck is clean for the API, admin and shared packages, and for every new or changed mobile file. Mobile has older errors in unrelated files.
- On device, the bundle reloads and the login screen shows the Staff login link.

## Needs manual verification

- **Owner:** Staff login as owner → Manage Today tab. The ink header shows "All stores", and the switcher lists 9 stores.
- **Persona switching:**
  - More → Switch to shopping → consumer home.
  - Account → Manage my store → back to Manage.
  - Kill and relaunch the app: the last persona is restored.
- **Manager:** Staff login as manager → the store is fixed to Harur Fresh Mart.
- **Staff:** the unsupported screen appears, and Sign out works.
- **Multi-org user:** the org picker appears, and choosing Martly QA shows only the QA Test Store.
- **More tab:** the module list changes by role. ORG_ADMIN sees Marketing; a manager doesn't.

## Modules (M1–M5)

| Area | Where | Highlights |
|---|---|---|
| Today | `(manage)/index` | Revenue and order KPIs (today vs yesterday, with 7-day sparklines), 7-day revenue bars, live queue, low stock, top products, recent orders. Refreshes itself on WebSocket order events. |
| Orders | `(manage)/orders`, `manage/orders/[id]` | Status tabs with counts, search, swipe right to advance, long-press for bulk status. Detail covers customer, items, payment breakdown, mark paid, timeline and live updates. The tab shows a PENDING badge and an in-app "New order" toast. |
| Catalog (store inventory) | `(manage)/catalog`, `manage/store-products/*` | Stock health tiles, tabs (low / out / unlisted / featured), quick-edit sheet (stock stepper, price, discount, listed, featured), full edit, and add product to store. |
| Delivery | `(manage)/delivery`, `manage/riders/*` | Date board with READY orders grouped by pincode or slot, multi-select then assign rider (creates a trip), trip start and cancel. Riders CRUD. |
| Service | `manage/{customers,reviews,return-requests,support-tickets,store-ratings}` | Customer wallet adjust, review moderation (bulk) and replies, return resolve, support ticket chat. |
| Insights | `manage/{review-analytics,customer-insights,store-intelligence}` | Analytics ported to cards with View-based charts, plus AI "Ask". |
| Catalog management | `manage/{products,categories,brands,collections,featured-products,recipes,onboard}` | Product CRUD with variants and gallery, mapping products to stores, taxonomy drill-down, collections with reordering, recipe ingredients, and the store onboarding wizard. |
| Marketing | `manage/{coupons,promos,banners,festival-events,notification-send,loyalty-settings,referral-settings,membership-plans,subscriptions}` | Full CRUD, a push notification hub (send, campaigns, templates, dashboard), and loyalty, referral and subscription configuration. |
| Org config | `manage/{stores,users,organizations,delivery-zones,delivery-slots,delivery-tiers,express-delivery}` | Store CRUD with a map pin and staff assignment, team users, organizations (SUPER_ADMIN), and delivery configuration. |

**Shared kit:**
- **UI:** `components/manage/ui/*`, plus the `ManageScreen` (tab), `ManageListScreen` and `ManageStackScreen` (stack) scaffolds.
- **Data hooks:** `lib/manage/{use-paged-list,use-resource,use-action}`.
- **Uploads:** `lib/upload.ts` handles image uploads, and `api.upload` sends multipart requests.

## New-order alerts

- **When an alert fires:** a COD or fully wallet-paid order alerts on creation. An online order alerts once its payment is verified.
- **Who gets it:** `services/staff-alerts.ts` sends a `NEW_ORDER` push with sound to the org's ORG_ADMINs and the store's STORE_MANAGERs.
- **On tap:** the push deep-links to `/manage/orders/:id`.
- **Live refresh:** order creation now also broadcasts over the WebSocket. Before this, the web admin's order lists didn't refresh when a new order arrived.
- **Migration:** `20261015100000_new_order_notification` adds the enum value. It was applied with `db execute` and `migrate resolve`, following the drift rule.

## Multi-tenancy fixes

Building the persona surfaced cross-org leaks in the existing API. None of them were introduced here, and all are fixed.

- **Store scoping:**
  - `org-scope` store assignments now ignore stores outside the token's org.
  - `storeId` is verified on: orders list, dashboard, stock summary, store-products, return-requests, support, store-ratings and review-analytics.
- **Reviews and wallets:**
  - Review moderation, status and reply are org-scoped, and reply is now ORG_ADMIN-only.
  - Wallet admin read and adjust are limited to customers of your org.
- **Delivery zones:** detail, update and delete are org-checked, `organizationId` is forced on create, and `storeIds` are validated.
- **Coupons and banners:** `:id` reads and writes are org-checked. Banners and membership plans are admin-only.
- **Products:**
  - `?organizationId=` no longer overrides visibility, and `catalogType=org` no longer exposes every org's products.
  - Variant updates must belong to the product being edited.
- **Rider location:** staff can only see orders and trips of stores they can access.
- **Users:** an ORG_ADMIN can't edit or delete admins, or users shared with another org.
- **Recipes and collections:** detail is org-checked, product ids are validated, and the lists no longer match everything for users without an org.
- **Attaching products to stores** (`stores/:id/products`, `store-products` create and bulk): only master products or the store's own org's products are allowed.
- **Store staff assignment:** users who work for another org are rejected.
- **`categories/:id/products`:** now requires auth and is filtered by catalog visibility.
- **Riders:** the rider pickers only list RIDER and STAFF users, so managers no longer appear.
- **Org context required:** the loyalty, referral and subscription admin routes and store creation now require an org in the token (`requireOrgContext`). Only SUPER_ADMIN can pass `?organizationId=`.

## Seeds

All are idempotent, run from `apps/api`:

```
npx tsx prisma/seed-manage-users.ts       # staff accounts (see table above)
npx tsx prisma/seed-manage-orders.ts      # 15 orders across statuses, last 7 days
npx tsx prisma/seed-manage-delivery.ts    # 2 riders + 5 READY express orders today
npx tsx prisma/seed-manage-service.ts     # reviews, returns, tickets, store ratings
npx tsx prisma/seed-manage-marketing.ts   # coupons, banners, loyalty/referral config, template, campaign, subscription
```

## Known gaps

- **No expiry:** `StoreProduct` has no expiry field, so there is no expiry editing or "expiring soon" view. Adding it needs a schema change.
- **Variants can't be deleted:** the API has no endpoint for it, and the web admin can't delete them either.
- **Dates:** coupon and discount dates are date-only on mobile; the web admin uses date and time.
- **Promos:** create depends on AI drafting, which doesn't complete locally, so Launch, End and Reopen are untested.
- **Not ported:** collection AI banner regeneration, festive-hero editing, and the AI product description tool.
