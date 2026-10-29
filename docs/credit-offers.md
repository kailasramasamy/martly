# Welcome credit

New customers get free shopping credit, e.g. ₹50, on their first order. Martly funds it (a super admin campaign with no store), or one store funds its own. Customers see Martly's as **Martly Cash** and a store's as **{Store} Cash**.

## Rules

- **Who gets it:** customers who have never placed an order. For Martly's credit that means anywhere; for a store's credit it means at that store. Cancelled orders don't count.
- **One per phone per funder.** `credit_grants` is unique on `(funder_key, phone)`. The funder key is `MARTLY` or the store id. The grant keeps the phone, so deleting the account and signing up again with the same number doesn't give a second credit. Accounts without a phone (email-only) get nothing.
- **Granted only where a store delivers.** The app calls `POST /credits/claim` once it has found a store that delivers to the customer's location, and the API checks this with `deliveryFeeTo`. Customers outside every delivery area get no grant and use no budget. `GET /credits/me` lists the offer as `pending`, and the app shows "saved for when we arrive".
- **Spending:** only on the customer's first order (at that store for store credit), only when the items less coupon meet the campaign's minimum, and never more than that amount. The minimum must be at least the credit, so a grant is always spent whole. Martly's credit works at any store; a store's credit only at that store. Both can apply to the same order.
- **It works like a coupon.** `Order.creditDiscount` comes off the total (`items − coupon − credit + delivery`). Wallet and loyalty then apply to what's left. Older app builds never send `useCredit`, so their totals don't change.
- **Never paid out as money:**
  - **Cancel:** the credit goes back to its grant, or expires if its date has passed.
  - **Door hand-backs and returns:** refunds use `paidShare()` (items less coupon and credit, over items). The credit's share is never refunded. This now applies to coupons on returns too; before, returns refunded the full item price.
- **Expiry:** after `validDays`. A sweep runs hourly (`plugins/credit-scheduler.ts`). It marks unused grants `EXPIRED` and sends one push `CREDIT_REMINDER_DAYS` (3) days before expiry.
- **Store limits:** a store gives at most `STORE_CREDIT_MAX_AMOUNT` (₹200) per customer; the super admin has no cap. Only the super admin can create Martly campaigns.

## Budget

A grant moves through `ACTIVE` → `RESERVED` (order placed) → `USED` (delivered). It can also go to `EXPIRED`.

| Number | Meaning | Counts against the budget |
|---|---|---|
| Outstanding | Active, unexpired grants | No, shown as possible future cost |
| Reserved | Grants held by placed orders | Yes |
| Spent | Grants on delivered orders | Yes |

- **New grants stop** when `spent + reserved + amount > budget`. The check runs under a row lock on the campaign, so parallel claims can't pass the budget.
- **When the budget is used up**, the campaign is no longer offered to guests and no longer listed as pending.
- **Grants already made are always honoured.** Spending can go over the budget by at most the outstanding amount, which admin shows as **Possible extra cost**.
- **The counts are computed from the grants** (`campaignUsage`), not stored as counters, so they can't drift.

## Ledger

- **On delivery**, Martly-funded credit posts `PLATFORM_CREDIT` (+, Martly pays the store), like a platform coupon. No commission is charged on it.
- **Store-funded credit posts nothing**: the store simply collected less.
- **Goods coming back:** Martly pays its credit only on goods the customer kept. A door hand-back posts it for the kept share; a refunded return takes the returned units' share back off the store. Martly coupons work the same way. See "Edge cases to test" in docs/store-ledger.md.
- **Undo delivery** reverses the entry and moves the grants back to `RESERVED`. Redelivering posts it again.

## API

| Endpoint | Who | What |
|---|---|---|
| `GET /credits/offers?storeId` | Anyone | What signing up gets a guest: Martly's offer plus the store's |
| `GET /credits/me?storeId` | Customer | Unused grants, plus offers they qualify for but haven't been given |
| `POST /credits/claim {storeId, lat, lng}` | Customer | Grant once a store delivers there; returns the same data as `/me` |
| `GET /credits/checkout?storeId&orderAmount` | Customer | Credit a first order of that amount (items less coupon) would take off |
| `POST /credits/grants/:id/seen` | Customer | The celebration was shown |
| `GET/POST/PATCH /credits/campaigns[/:id]` | `MARKETING_MANAGE` | Campaigns with usage. Staff only see their stores' campaigns |
| `POST /orders` `useCredit: true` | Customer | Spend the credit at checkout |

Code: `services/credits/` (campaigns, grants, spend, sweep), `routes/credits/`, shared `constants|schemas|types/credits.ts`.

## Apps

- **Admin:** Marketing → Welcome credit (`/welcome-credit`). List with budget progress and usage; create and edit forms. Order detail shows the credit line.
- **Mobile, customer side:**
  - guest banner on Home and an offer line on login
  - celebration sheet after the grant
  - "saved for when we arrive" card
  - reminder strip on Home and Cart, with "add ₹X more"
  - checkout line, always applied when it qualifies (no switch: there is no later order to keep it for)
  - first-order warnings: the cart strip says what's applied and what more unlocks the rest; above Place order, a note names any credit this order leaves unused, since later orders can't use it
  - Martly Cash section in Wallet
  - credit line in order summaries
- **Mobile, Manage app:** Marketing → Welcome credit, to create and edit campaigns for the store.

## Seed

`cd apps/api && npx tsx prisma/seed-welcome-credit.ts` creates Martly ₹50 (minimum ₹199, 14 days, budget ₹5,000) and a ₹30 campaign at the first live store (minimum ₹249, budget ₹1,500).

## Tested (curl against a local API, 2026-10-29)

- **Offers:** a guest sees Martly ₹50 and Sree Ranga ₹30. A customer with no store sees Martly's offer as pending.
- **Claim outside every delivery area (Chennai):** 400, and no grant is created. Claim near Sree Ranga: both grants. Claiming again doesn't duplicate them.
- **Checkout preview:** ₹150 → no credit, ₹260 → ₹80, ₹300 → ₹80. After the first order: no credit.
- **Order (items ₹280, `useCredit`):** total ₹200, `creditDiscount` ₹80, grants `RESERVED`, campaign reserved ₹50 and ₹30. The customer cancels → grants are `ACTIVE` again.
- **Delivered:** grants `USED`, ledger `PLATFORM_CREDIT` +₹50 only (not the store's ₹30), commission ₹4 on the ₹200 actually paid.
- **Undo delivery:** grants back to `RESERVED`, entries reversed. Redelivery nets the ledger at +₹50 and −₹4.
- **Same phone on a new account after deletion:** no grant.
- **Budget ₹100 with ₹50 spent:** two new customers both get grants (possible extra cost ₹50). Once one orders (committed ₹100), the next customer gets only the store credit. The other's order still gets its ₹50 (committed ₹150 against a ₹100 budget). Used-up campaigns disappear from guest offers and the pending list.
- **Store owner limits:**
  - creating a Martly campaign → 403
  - ₹300 store credit → 400
  - a minimum below the amount → 400
  - the owner only sees their own store's campaigns
- **Seen:** the owner marks it seen; another customer gets 404.
- **Return** of a ₹130 item from a ₹260 order with ₹80 credit → ₹90 requested.
- **Sweep:** an expired grant becomes `EXPIRED`. The grant 2 days from expiry gets "Your ₹30 expires in 2 days", and a second run doesn't send it again.

## Check by hand

- **Mobile build, as a new phone number:**
  - inside a delivery area: banner → sign-up → celebration → checkout line → order → Wallet
  - outside every delivery area: the "saved" card
- **Admin:** create, edit and list as super admin and as a store owner.
- **Manage app:** the Welcome credit screen for a store manager.
- **Tamil copy** on all of the above.
- **Mobile has no OTA updates:** the customer UI needs a store build. Until then, older builds simply never send `useCredit`.
