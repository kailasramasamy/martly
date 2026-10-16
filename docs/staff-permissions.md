# Staff permissions, local brands and stock counts

## How it works

### Roles are presets, permissions are what's checked

Every staff member has one role (Owner/ORG_ADMIN, Store Manager, Staff, Rider). Each role comes with a preset bundle of permissions. The owner can switch on extra **responsibilities** (add-on permissions) for an individual member, per organization.

The API, the web admin and the mobile app all check **permissions**, never roles. Only two kinds of check still use roles:
- **Platform-only:** organizations, taxonomy, master brands and master products are `requireRole("SUPER_ADMIN")`.
- **Shopper-only:** customer routes are `requireRole("CUSTOMER")`.

Permissions decide **what** a member can do. Store assignment (`UserStore`, checked by `org-scope.ts`) still decides **where**.

**Where things live:**
- **Permissions:** the catalogue, presets (`ROLE_PERMISSIONS`), grantable add-ons (`ROLE_ADDONS`), labels (`PERMISSION_META`), `can()` and `hasPermission()` are all in `packages/shared/src/permissions/`.
- **Add-ons:** stored in `member_permissions`, one row per (user, organization).
- **Effective permissions:** preset ∪ allowed add-ons. They are worked out at login, org-select and every token refresh (`services/permissions.ts`, `services/auth-tokens.ts`) and carried in the access token. `/auth/me` also returns them.
- **Timing:** grants and revocations take effect at the next token refresh, within 15 minutes. Refresh now re-reads the role and org membership from the database. It used to copy the role from the old token for up to 30 days.

**Defaults:**

| Role | Included | Owner can add |
|---|---|---|
| Owner | everything | n/a |
| Store Manager | all order actions, riders, listing (availability, listings, prices), all stock incl. approving counts, add & edit products, reports, store settings, payments | local brands, collections, marketing, delivery setup, returns, support, refunds |
| Staff | toggle availability, view stock | order view/process/dispatch/cancel, deliver, catalog (products, brands, collections), prices, listings, receive/count/adjust stock, returns, support, reports |
| Rider | view orders, deliver own trips | process, dispatch, stock count |

The migration gave every existing Staff member order view/process/dispatch + deliver, and every existing Rider dispatch, so nobody lost access on release.

### Online orders

Each status change needs a permission, defined in shared `transitionPermission()`:

| Move to | Needs |
|---|---|
| Confirmed / Preparing / Ready | Process orders |
| Out for delivery, Delivered | Dispatch orders, or a rider with Deliver delivering an order on their own trip |
| Cancelled | Cancel orders, plus a **reason** (saved on the status history) |

- **Bulk updates** only move orders between non-final stages. Delivering and cancelling run refunds, loyalty and stock one order at a time.
- **New-order alerts** go to the org's owners plus everyone assigned to the store who can process orders.
- **Order buttons** in both apps come from shared `permittedNextStatuses()`, so a member never sees an action they can't take.

### Local brands

- **Ownership:** `brands.organization_id` is null for master brands and set for an organization's own local brands.
- **Who can create and edit:** members with *Local brands* (`CATALOG_BRANDS`) manage their organization's brands. Only the platform admin manages master brands and sets `popularity`, which ranks brands in every store's search.
- **Who sees which brands:** brand lists show master brands plus the caller's own. Guests and shoppers see master brands; customer brand pages come from the store's listings anyway.
- **Using brands on products:** products, catalog drafts and the catalog agent's brand matching may only use master brands or the product's own organization's brands.
- **Slugs:** stay globally unique and are generated collision-free (`services/brands.ts`).

### Catalog editors

Members with *Add & edit products* (`CATALOG_PRODUCTS`) create and edit their organization's products and run catalog drafts. A product they create is listed in the stores they work in.

### Stock ledger and counts

**Every stock change goes through `applyMovement()`** (`services/stock-ledger.ts`). It locks the row, applies the change and writes a `stock_movements` row with the type, change, before/after, who and why. Movement types:

| Type | Created when |
|---|---|
| RECEIVE | A delivery is received, a product is listed with opening stock, or a draft is published |
| SALE | An order is delivered, by staff or by a rider on their trip |
| DAMAGE / EXPIRY / MANUAL | A member adjusts stock (a note is required), or edits stock on a store product |
| COUNT | An approved stock count is applied |

**Stock counts are blind:**
1. A member with *Stock count* starts a count for one aisle (subcategory) in a store and enters what's on the shelf. System stock is never shown while counting.
2. On submit, system stock is snapshotted per line.
3. A member with *Approve counts* sees counted vs system and approves or rejects. Approval applies each **difference** as a COUNT movement, so sales made after the count stay correct.
4. A submitter who can approve has their count applied straight away.

### Undo delivery

A delivery marked by mistake can be undone within **2 hours** by anyone who can cancel orders. A reason is required, picked from the same chip sheet as cancel. It moves the order back to *Out for delivery*, or to *Ready* for pickups, and reverses what delivery did:

- **Stock:** sold stock goes back on the shelf as `UNDO_SALE` movements and is re-reserved for the order.
- **COD payment:** returns to Pending if delivery had marked it paid.
- **Loyalty:** points earned are taken back.
- **Rider trip:** a completed trip is reopened.
- **Customer:** gets an "Order status corrected" notification.

It's refused, with a message pointing to returns, after 2 hours or if the order already has a return request, a review, or paid out a referral reward. Code: `services/order-undo.ts`, `routes/orders/undo-delivery.ts`.

## What was tested (local API, curl)

- **Tokens:** they carry effective permissions. Owner grant and revoke of add-ons works, and invalid add-ons for a role are rejected (400). A Store Manager can't grant (403).
- **Order access:**
  - Staff without the orders add-on get 403 on orders. Staff with it, managers and riders can read them.
  - Staff and riders get 403 on cancel. A manager's cancel without a reason gets 400.
  - Bulk cancel is rejected (400). Bulk updates without permission get 403.
- **Riders list:** shows only members who can deliver.
- **Catalog editor:**
  - Can create a local brand; the popularity they send is ignored.
  - Gets 403 editing a master brand and can edit their own brand.
  - Guests don't see the local brand.
  - Can create a product with their local brand, and it's listed only in their store.
- **Store product fields:** floor staff can toggle availability even when the form resends unchanged stock, and get 403 changing stock or price.
- **Counts:**
  - The counter creates, fills and submits a count, with system stock hidden.
  - The counter can't approve (403).
  - The manager sees counted 74 vs system 71 and approves, which records a +3 COUNT movement.
  - A manager damage write-off of −2 is recorded. The counter can't adjust (403).
- **Delivery:** delivering an order records one SALE movement per item with the correct before/after.

## Needs manual verification

- **Web admin:**
  - Users → edit a staff member → the Responsibilities card toggles and saves.
  - Order page and delivery board show only permitted actions, and cancel asks for a reason.
  - Brands list shows Master/Local tags, with edit only on brands you own.
  - Stock counts, Receive stock, and stock adjust/history.
- **Mobile (iPhone):**
  - Log in as each seeded user (`seed-manage-users.ts`) and confirm the visible Manage tabs: no Today without Reports, no Orders/Delivery without View orders.
  - `plain@harur.dev` lands on Inventory.
  - Team → edit member → Responsibilities.
  - Order cancel reason sheet; bulk bar without cancel.
  - Stock count flow end to end, approval as `manager@harur.dev`, receive stock, and adjust/history on a store product.
- **Rider delivery from the rider app:** stock is now deducted on delivery. COD auto-paid and loyalty points are still not applied on that path; this was a pre-existing gap and is unchanged.
