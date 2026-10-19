# Return/Refund Requests

## Overview

Customers raise a return within 48 hours of delivery. Store staff approve it with an **outcome**: what the customer gets (refund or replacement) and whether the item has to come back. Most grocery returns are refunded straight away and the customer keeps the item. Collecting one item from a village isn't worth a dedicated trip, so items that do need to come back ride on the customer's **next order** or are **dropped at the store**. Riders can also take items back **at the door**, which avoids a return altogether.

## Flow

1. **Customer** opens a delivered order (within 48h of the DELIVERED status log) and raises a return: items, quantities, reason, optional description and photos.
2. **Staff** (RETURNS_HANDLE) approve or reject. Approving picks:
   - **Remedy:** `REFUND` (wallet) or `REPLACE` (a free unit on the next order)
   - **Method:** `KEEP` (customer keeps it), `NEXT_ORDER` (rider collects it with the next order) or `AT_STORE` (customer drops it off)
   - **Restock** per item: put back on the shelf once received
   - Defaults: `KEEP` when the amount is at or below the store's `returnKeepThreshold`, or the reason is damaged, expired, missing or poor quality (`RETURN_KEEP_REASONS`); otherwise `NEXT_ORDER`. "Wrong item received" defaults to restock.
3. **Status:** `PENDING` → `IN_PROGRESS` → `APPROVED` (shown as Completed). `REJECTED` and `EXPIRED` are final.
4. **Refund timing:** `REFUND` + `KEEP` pays at approval. Otherwise it pays when the item is received: the rider collects it (`POST /:id/collect`) or staff mark it received at the store (`PATCH /:id/receive`). Received items marked restock get a `RETURN` stock movement.
5. **Replacement:** when the customer next orders at that store, pending replacements are added as ₹0 items (`OrderItem.replacesReturnId`) with stock reserved. If one is out of stock, the return becomes a refund. Cancelling that order puts the replacement back to pending.
6. **Fallbacks** (`plugins/returns-scheduler.ts`, hourly, counted from approval):
   - `NEXT_ORDER` not collected within `RETURN_COLLECT_DAYS` (7) switches to `AT_STORE` and the customer is told.
   - Item still not back after `RETURN_EXPIRY_DAYS` (14): the return becomes `EXPIRED`, with no refund.
   - A replacement not sent within 7 days becomes a refund.
   - Customers can switch between `NEXT_ORDER` and `AT_STORE` themselves until the item is received.

## Handing items back at the door

The rider's deliver dialog lets the customer hand back units, with a reason per line (`DAMAGED`, `EXPIRED`, `WRONG_ITEM`, `NOT_WANTED`). On `PATCH /orders/:id/status` with `refused`:

- Only kept units are sold (`SALE`). Damaged or expired units are written off (`DAMAGE` / `EXPIRY`); the rest simply stay in stock.
- `Order.refusedAmount` is the refused units' price less their share of the coupon (`refusedValue` in `@martly/shared/order-flow`).
- COD cash due drops by that amount. Anything already paid by wallet, points or online beyond the cash due goes back to the wallet.
- Loyalty is earned on the total minus `refusedAmount`.
- Handing back every unit is rejected; use "Couldn't deliver" instead.
- Refused units can't be returned again later, and a delivery with refused items can't be undone.

## Code map

| What | Where |
|------|-------|
| Approve / reject | `apps/api/src/services/returns/resolve.ts` |
| Receive, refund, restock, completion | `apps/api/src/services/returns/settle.ts` |
| Rider pickups on stops, collect permission | `apps/api/src/services/returns/pickups.ts` |
| Hand back at the door | `apps/api/src/services/returns/door-refusal.ts` |
| Replacements on the next order | `apps/api/src/services/returns/replacement.ts` |
| Fallback sweep | `apps/api/src/services/returns/sweep.ts` |
| Customer notifications | `apps/api/src/services/notify/return-alerts.ts` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/return-requests` | CUSTOMER | Create a request |
| GET | `/api/v1/return-requests/my-requests` | CUSTOMER | Own requests (paginated) |
| GET | `/api/v1/return-requests/my-requests/:orderId` | CUSTOMER | Request for an order, with store contact |
| PATCH | `/api/v1/return-requests/my-requests/:id/method` | CUSTOMER | Switch `NEXT_ORDER` ↔ `AT_STORE` |
| GET | `/api/v1/return-requests/my-replacements?storeId` | CUSTOMER | Replacements coming with the next order |
| GET | `/api/v1/return-requests` | ORDERS_VIEW / RETURNS_HANDLE | List (store-scoped) |
| GET | `/api/v1/return-requests/:id` | ORDERS_VIEW / RETURNS_HANDLE | Detail |
| PATCH | `/api/v1/return-requests/:id/resolve` | RETURNS_HANDLE | Approve with remedy and method, or reject |
| PATCH | `/api/v1/return-requests/:id/receive` | RETURNS_HANDLE | Item dropped at the store |
| POST | `/api/v1/return-requests/:id/collect` | DELIVERY_DELIVER (own trip) / RETURNS_HANDLE | Rider collected it with `orderId` |

Rider stops (`GET /delivery-trips/mine`) and `GET /orders/:id` carry `pickups`: the customer's returns waiting for collection at that store.

## Store setting

`Store.returnKeepThreshold` (₹, optional) is set in the admin store edit page and in Manage store settings.

## What was tested (API, curl against local DB)

- Create; approve with `REFUND` + `AT_STORE`: the amount is capped at the requested amount, no wallet change, double-approve is refused.
- Customer switches method both ways; staff receive refunds the wallet and records a `RETURN` movement only for restock items; a second receive is refused.
- The rider stop lists the pickup. Collecting with another customer's order is refused; collecting on the out-for-delivery order refunds and completes the return.
- Deliver with 1 damaged unit handed back: one `SALE`, one `DAMAGE`, reservation released, log note added, COD due reduced. Undo delivery is refused. A later return of the refused quantity is refused.
- Prepaid order with a coupon: a ₹48 unit handed back credits ₹43.20 to the wallet (coupon prorated). A wrong item stays in stock.
- Handing back every unit is refused.
- A replacement attaches to the customer's next order as a ₹0 line with stock reserved. Cancelling that order reopens the return and releases the stock.
- Sweep: a `NEXT_ORDER` return 8 days old moves to `AT_STORE`, a 15-day-old one expires, and a stale replacement becomes a wallet refund. Each sends a customer notification.

## Seed

`cd apps/api && npx tsx prisma/seed-returns.ts` sets up the following for the OTP review customer at Harur Fresh Mart:
- a fresh delivery to return
- returns waiting to be collected, dropped off and replaced, plus one pending
- an order out with `rider@harur.dev` that carries the pickup
- the store's keep-it limit set to ₹150

## Manual Verification

Run `npx tsx prisma/seed-returns.ts` first. Log in as:
- Customer: OTP review login (`OTP_REVIEW_PHONE` / `OTP_REVIEW_CODE`)
- Staff: `owner@harur.dev` / `owner123`
- Rider: `rider@harur.dev` / `rider123`

### Customer app
- [ ] The fresh delivery shows "Request Return/Refund". The form hides units already handed back at the door.
- [ ] The return status card shows each state correctly:
  - pending
  - collect with next order, with the "drop at store instead" link
  - drop at store, with store address and call button
  - replacement, keep the item
  - completed
  - expired
- [ ] Switching method updates the card and shows a toast.
- [ ] Checkout at Harur shows "Free replacement with this order".
- [ ] An open order with a pending pickup shows the amber "keep the item ready" callout.
- [ ] A delivered order with handed-back items shows the line tag and the "Handed back at door" breakdown row. For COD, cash is reduced; for online, it says refunded to wallet.

### Rider (Manage → Delivery)
- [ ] The seeded stop shows "Also collect: …" on the next-stop card and in the stop sheet.
- [ ] In the deliver dialog:
  - ticking "Collected" and confirming completes the return and refunds the wallet
  - handing back 1 unit lowers the cash figure
  - choosing every unit disables confirm with the hint
  - a handed-back line with no reason disables confirm

### Staff (Manage app and admin)
- [ ] Approve a pending return:
  - "Customer keeps it" is preselected for a cheap item or a damaged/expired reason, with a hint
  - choosing "Collect with next order" shows the restock toggles
- [ ] Mark a drop-at-store return received: the wallet is refunded and stock goes up when restock is on.
- [ ] The Returns list has an In progress tab (Manage) or filter (admin) and an Outcome column (admin).
- [ ] Order detail shows "Free replacement", handed-back tags, and the "Return to collect" callout.
- [ ] The store edit page (admin) and store settings (Manage) save the "Return keep-it limit".
