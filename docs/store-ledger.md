# Store Ledger and Settlements (design)

Status: **Phases 1–3 built 2026-10-19** (see "Build notes" at the end). Phase 4 (RazorpayX/Route payouts, brand-funded promos, TCS/TDS) is not built and waits on the open questions.

## Why

Every online payment lands in Martly's single Razorpay account. Every refund (cancellation, return, door hand-back) is credited to the customer's Martly wallet, and that wallet works at any store in any organization. Nothing records what Martly owes each store, or what a store owes Martly.

For example:

- A customer pays ₹500 online.
- Martly pays the store ₹500 outside the app.
- The customer returns the item, and Martly credits ₹500 to their wallet.

Martly is now ₹500 out of pocket, and no record says the store should cover it.

The ledger is a running, per-store account between Martly and the store. Every money event writes an entry in the same transaction that moves the money. Store owners see every rupee on the phone and in admin. Settlements pay out the net balance and recover refunds automatically.

## Principles

1. **The store bears the cost of its own sales.** Refunds, returns and hand-backs at the door are debited to the store that made the sale. Martly bears a cost only when Martly chose to fund it (platform coupons, goodwill credits).
2. **Who holds the cash decides the entry.** Money Martly holds becomes a ledger entry. Money the store holds (COD cash, UPI to the store) is shown on statements for completeness but doesn't move the balance.
3. **Append-only.** Entries are never edited or deleted. Corrections are reversing entries.
4. **Posted in the same transaction as the money event.** If an entry can't be written, the payment, refund or delivery doesn't happen. Each source event posts at most once, enforced by a unique `(type, sourceId)`.
5. **Sales are earned on delivery, not on payment.** An online order cancelled before delivery never touches the ledger. Its refund goes to the wallet, and Martly simply holds less money.
6. **Hold before payout.** An entry becomes available for settlement only after the return window plus a buffer has passed (`deliveredAt + RETURN_WINDOW_HOURS + 24h`), so late refunds can still be netted.

## Who holds the money today

| Flow | Who pays | Who receives | Ledger effect |
|---|---|---|---|
| Online order (Razorpay) | Customer | Martly | **+** online amount, on delivery |
| Wallet used on an order | Customer's wallet (Martly money) | Martly | **+** wallet amount, on delivery |
| Loyalty points redeemed | Organization (points are per org) | — | None: the store simply collected less |
| COD, cash or UPI at the door | Customer | Store or rider | **−** Martly commission (COD rate) only. Shown on the statement for information. |
| Org coupon (`organizationId` set) | Organization | — | None: the store simply collected less |
| Platform coupon (`organizationId` null) | Martly | — | **+** coupon discount (Martly reimburses the store) |
| Delivery fee | Customer | Store (part of the total) | Included in the sale amounts above |
| Cancellation refund (before delivery) | Martly to the wallet | Customer | None (no sale was recorded) |
| Return refund to wallet | Martly to the wallet | Customer | **−** refund amount |
| Door hand-back credited to the wallet | Martly to the wallet | Customer | **−** wallet credit |
| Door hand-back on COD (less cash collected) | — | — | None: the store collected less |
| Referral reward | Martly to the wallet | Referrer and referee | **−** reward to the referee's first-order store (the org set the reward) |
| Membership purchase | Customer | Martly | **+** price paid (org-level entry, no store) |
| Support wallet credit tied to an order | Martly to the wallet | Customer | **−** if org staff issued it, none if Martly issued it as goodwill |
| Store plan, top-ups, AI image packs, ads | Organization | Martly | Paid by invoice today. Phase 3 allows paying from a positive balance. |
| Brand-funded promo price cuts | Brand to Martly | — | **+** brand-funded discount (Phase 4, once promos record their funder) |
| Wallet recharge, forfeit on account deletion | Customer / Martly | Martly | None (platform money, no store) |
| Undo delivery | — | — | Reversal of every entry that delivery posted |

## Data model

### `LedgerEntry` (append-only)

| Field | Notes |
|---|---|
| `id` | UUID |
| `organizationId` | Always set |
| `storeId?` | Null for org-level entries such as memberships |
| `type` | `LedgerEntryType` (below) |
| `amount` | Signed `Decimal(12,2)`. Positive means Martly owes the store. |
| `sourceType`, `sourceId` | e.g. `ORDER`/orderId, `RETURN`/returnRequestId. **`@@unique([type, sourceId])`** makes posting idempotent. |
| `orderId?` | For drill-down |
| `availableAt` | When the entry becomes settleable (the hold) |
| `settlementId?` | Set when a settlement picks the entry up |
| `memo` | Human-readable line, e.g. "Online payment · order #A1B2C3D4" |
| `createdBy?` | Staff or super-admin user for manual entries |
| `createdAt` | |

Indexes: `(organizationId, storeId, createdAt)`, `(organizationId, settlementId, availableAt)`.

`LedgerEntryType`:
- **Sales:** `SALE_ONLINE`, `SALE_WALLET`, `PLATFORM_COUPON`, `BRAND_FUNDED`
- **Refunds:** `RETURN_REFUND`, `DOOR_REFUND`, `REFERRAL_REWARD`, `GOODWILL_DEBIT`
- **Org-level:** `MEMBERSHIP_SALE`, `PLAN_FEE`
- **Bookkeeping:** `REVERSAL`, `ADJUSTMENT` (super admin only, reason required), `SETTLEMENT_PAYOUT`, `OPENING_BALANCE`
- **Reserved (not used yet):** `PLATFORM_FEE`, `TCS`, `TDS`

### `Settlement`

| Field | Notes |
|---|---|
| `number` | `STL/2026-27/0001`, from a counter like `MarketingInvoiceCounter` |
| `organizationId` | Settles per organization; the statement breaks it down per store |
| `periodStart`, `periodEnd` | IST |
| `credits`, `debits`, `carriedIn`, `net` | Totals |
| `status` | `DRAFT` → `APPROVED` → `PAID`, or `FAILED` / `CARRIED_FORWARD` |
| `payoutMethod`, `utr`, `paidAt`, `paidBy` | How and when it was paid |
| `statementUrl` | A signed HTML statement, same pattern as `services/marketing/invoice.ts` |

### `OrgPayoutAccount`

- Account holder, bank account (stored encrypted; only the last 4 digits are ever shown), IFSC, optional UPI VPA.
- `verifiedAt` / `verifiedBy`: Martly verifies before the first payout.
- Only the owner (`ORG_ADMIN`) can change it. Every change notifies all owners and resets verification.

### Changes to existing models

- **`WalletTransaction`:** add `organizationId?`, `storeId?` and a `reason` enum (`ORDER_PAYMENT`, `CANCEL_REFUND`, `RETURN_REFUND`, `DOOR_REFUND`, `REFERRAL`, `RECHARGE`, `SUPPORT`, `SUBSCRIPTION`, `FORFEIT`). Today a credit can only be traced through free text.
- **`Coupon`:** add `fundedBy` (`ORG` | `PLATFORM`). Coupons with no organization default to `PLATFORM`.
- **Wallet credits issued from `routes/wallet`:** add `fundedBy` and an optional `orderId`.

## Posting

There is one writer, `services/ledger/post.ts`, used as `postEntries(tx, entries[])`. Each call site passes the transaction it already runs in.

| Hook | Entries |
|---|---|
| Order DELIVERED (`routes/orders/index.ts` status route, next to `deliverWithRefusals`) | `SALE_ONLINE`, `SALE_WALLET`, `PLATFORM_COUPON`, and `DOOR_REFUND` when the hand-back credited the wallet |
| Return refunded (`services/returns/settle.ts` `refundToWallet`) | `RETURN_REFUND` |
| Undo delivery (`services/order-undo.ts`) | `REVERSAL` of every entry for that order |
| Referral completed (orders status route) | `REFERRAL_REWARD` |
| Membership purchase verified (`routes/memberships`) | `MEMBERSHIP_SALE` |
| Support wallet credit with `fundedBy: ORG` | `GOODWILL_DEBIT` |
| Settlement paid | `SETTLEMENT_PAYOUT` (−net) |

Subscription orders are paid wholly from the wallet, so on delivery they post `SALE_WALLET`.

## Settlement cycle

1. **Weekly run.** A new `plugins/settlement-scheduler.ts` runs Monday 06:00 IST, using the `alertOnce` key `stl:{orgId}:{weekStart}`.
   - For each organization it sums every entry that is unsettled and whose `availableAt` has passed, plus the carried-in balance.
   - It creates a `DRAFT` settlement and links the entries.
2. **Positive net at or above the minimum payout (e.g. ₹100):** the settlement becomes `APPROVED`.
   - **Phase 2:** Martly finance pays by bank transfer or UPI and records the UTR. Status → `PAID`.
   - **Phase 4:** RazorpayX payouts or Razorpay Route, automated.
3. **Net below the minimum:** `CARRIED_FORWARD` to next week.
4. **Negative net:** carried forward and recovered from later payouts.
   - If it stays negative for 4 weeks and is above ₹500, Martly raises an invoice the same way as `AdOrder`, or the store pays it from the app.
   - This mostly affects COD-heavy stores, which are exactly the stores in tier-2 cities and villages. See "COD refunds" below.
5. **Failed payout** (bank rejects it): `FAILED`, the entries are released back to the next run, and owners are escalated.

### COD refunds: a change to the returns flow

When the customer paid cash, refunding them through the Martly wallet makes the store owe Martly money that Martly can't net against anything. Add a `CASH` refund destination for COD orders:

- **Rider collects the item:** the rider hands the cash back on the spot.
- **Store drop:** the counter pays the cash.
- **Either way:** the store pays the customer directly, so there is no ledger entry. A memo line shows on the statement.

The wallet stays available as the customer's choice. This keeps village stores out of negative balances.

## What owners see

The visibility rule is the same everywhere:

- **Owner (`ORG_ADMIN`):** every store in the org, plus org-level entries and payouts.
- **Store manager with `FINANCE_MANAGE`:** their own stores' entries. No payouts, no bank details.

Add a resource `finance` to `RESOURCE_PERMISSIONS` (`FINANCE_MANAGE`), and update the `FINANCE_MANAGE` description from "Override order payment status" to "Payments, ledger and payouts".

### Mobile (Manage)

Mobile gets a new entry, **More → Organization → Payments & payouts** (`app/manage/finance/`).

- **Overview**
  - **Available:** settles on the next run.
  - **On hold:** inside the return window, with an "available from" date per entry.
  - **Next payout:** date and amount.
  - **Last payout:** amount, UTR, date.
  - **COD collected this week:** for information.
  - A store switcher (`useManageScope`).
- **Activity:** every entry. It uses `ManageListScreen` with tabs All / Sales / Refunds / Payouts, a store filter and date search.
  - Each row shows a type icon, a memo such as "Return refund · order #…", a signed ₹ amount, and a pill: On hold, Available, or Settled `STL/…`.
- **Entry detail:** a breakdown with links to the order or return, and "Raise a query", which opens a support ticket prefilled with the entry.
- **Payouts:** a list of settlements (`InvoiceList` pattern). Each one shows a statement grouped by store and type, with the payout status and UTR. Download statement opens the signed HTML.
- **Payout account** (owner only): bank or UPI details, verification status.
- **Today tab card** (`REPORTS_VIEW` plus `FINANCE_MANAGE`): "₹X payout on Monday", or "Balance −₹X, recovered from next payouts".

### Admin, organization view

Admin gets a **Finance** sidebar group with:
- **Ledger:** a table filtered by store, type, status and date, with CSV export.
- **Settlements:** list and statement detail.
- **Payout account.**

These are full-width tables. The payout account form and statement header go in `ReadableSection`.

### Admin, platform view (SUPER_ADMIN)

- **Balances:** every organization's available, on-hold and negative balance, sortable.
- **Payout queue:** `APPROVED` settlements.
  - Approve, or mark paid with UTR and method (bulk select).
  - Export a bank bulk-upload CSV.
- **Payout accounts awaiting verification.**
- **Manual adjustment:** organization, store, amount, required reason. It posts an `ADJUSTMENT`, which is audit-logged and visible to the owner.

## Notifications

There is a new `NotificationType` **`STAFF_FINANCE`**:
- Add it to the Prisma enum, `packages/shared/src/constants/notifications.ts` and `STAFF_NOTIFICATION_TYPES`.
- Deep links: `data.screen` is `manage-finance` or `manage-settlement`.
- Delivery goes through `notifyStaff` (store-scoped) or `notifyOrgStaff` (org-wide), and owners get it via `escalation`.

| Event | Audience | Copy (draft) |
|---|---|---|
| Settlement approved | Owners plus `FINANCE_MANAGE` (org) | "₹12,340 payout scheduled · STL/2026-27/0042" |
| Payout paid | Owners | "₹12,340 paid to ••4821 · UTR 4471…" |
| Payout failed | Owners (escalation) | "Payout of ₹12,340 failed: account details rejected. Update them in Payments." |
| Balance negative at settlement | Owners, once a week (`alertOnce`) | "Refunds exceeded sales this week. Balance −₹840, recovered from next payouts." |
| Negative 4 weeks, invoice raised | Owners (escalation) | "₹1,240 is due to Martly. Pay from Payments." |
| Large refund debit (over ₹1,000, store-configurable) | `FINANCE_MANAGE` at that store | "₹1,450 return refund on order #… debited to Harur Fresh Mart" |
| Adjustment posted by Martly | Owners | "Martly adjusted your balance by +₹200: {reason}" |
| Payout account changed | All owners (escalation, security) | "Payout bank account changed by {name}. Payouts pause until Martly verifies it." |
| Payout due but no verified account | Owners, at most once a day | "Add your bank details to receive ₹12,340" |
| Settlement run finished (platform) | Super admins | "38 settlements ready to pay · ₹4,12,300" |

Customers get no new notifications; the refund notifications already exist. Riders get none from the ledger itself. Once COD cash refunds land, the rider is told the cash to hand back in the deliver dialog.

## Rollout

1. **Prerequisite fix:** `prepareOrderPayment` (`services/order-payment.ts:20`) charges `totalAmount - walletAmountUsed` and ignores `loyaltyPointsUsed`, so loyalty redeemers paying online are over-charged. Fix it first; the ledger assumes the order fields are true.
2. **Phase 1, foundation:**
   - Models, the `fundedBy` and `reason` fields, and the posting hooks.
   - A backfill. It posts `OPENING_BALANCE` per store from the go-live date: online and wallet sales delivered since the last manual settlement, minus refunds. The owner confirms it.
   - Read-only views on mobile and admin, and the large-debit notification.
3. **Phase 2, settlements:** payout account, weekly run, platform payout queue with UTR, statements, payout notifications.
4. **Phase 3, COD and recovery:** the `CASH` refund destination in returns and door hand-backs, negative-balance invoicing, paying plan or ad invoices from a positive balance.
5. **Phase 4, automation and compliance:** RazorpayX or Route payouts, brand-funded promo entries, TCS/TDS if required.

## Open questions (decide before Phase 2)

1. **Regulatory:** collecting customer money and paying it on to stores may need a payment-aggregator licence, or Razorpay Route, where Razorpay holds and splits the funds. Confirm with a CA or lawyer.
   - With Route, the ledger is still the record owners see; Route only becomes the payment rail.
   - If needed, this decides whether Phase 2 is manual payouts or Route.
2. **Tax:** an e-commerce operator collecting on behalf of sellers may owe GST TCS (section 52) and income-tax TDS (194-O) on payouts. Confirm the rates and whether they apply. Entry types `TCS`/`TDS` are reserved.
3. **Platform fee:** is Martly SaaS-only (plans), or will it take a commission per order? `PLATFORM_FEE` is reserved.
4. **Wallet scope:** keep one Martly-wide wallet (the ledger handles cross-org spending through `SALE_WALLET`), or make refund credit usable only at the issuing organization?
5. **Referral funding:** confirm the organization bears referral rewards, since it configures them.
6. **Cycle:** weekly on Monday, the ₹100 minimum payout, and the hold of return window + 24h.

## Edge cases to test

- **Undo delivery:** every posted entry is reversed; no double reversal.
- **Return refunded after its sale was already settled:** the debit lands in the next settlement.
- **Door hand-back:** COD gives no entry. Prepaid gives `SALE_ONLINE` for the full amount and `DOOR_REFUND` for the wallet credit, netting correctly.
- **Replacement sent free:** no money entry. Its stock cost stays with the store.
- **Order paid partly by wallet and partly by COD:** `SALE_WALLET` only.
- **Platform coupon on a COD order:** `PLATFORM_COUPON` credit, since the store collected less cash.
- **Concurrent posting:** a duplicate `(type, sourceId)` is ignored rather than throwing, so retries are safe.
- **Store moved between organizations or deactivated:** entries stay with the original organization, and the settlement still pays out.
- **Rounding:** all amounts are in paise-safe `Decimal`, and statement totals equal the sum of their lines.

## Build notes (2026-10-19)

### What was built

- **Ledger:** the `LedgerEntry` model, posted by `services/ledger/post.ts` (`postEntries`, `createMany` with `skipDuplicates` on `(type, sourceId)`). The hooks are:
  - delivery: `services/ledger/order.ts`, called from the orders status route;
  - return refunds: `services/returns/settle.ts`;
  - undo delivery: `services/order-undo.ts`;
  - membership verify;
  - support wallet adjustments: `services/ledger/goodwill.ts`;
  - plan and ad purchases paid from the balance: `services/marketing/billing.ts`.
- **Settlements:** `services/ledger/settlement.ts` and `plugins/settlement-scheduler.ts`.
  - The run is weekly, at Monday 06:00 IST or later, keyed by `stl:{org}:{weekStart}`. The key is claimed in the same transaction that writes the settlement.
  - A net of ₹100 or more becomes `APPROVED` if the payout account is verified, otherwise `DRAFT`. Owners get a daily reminder to add bank details.
  - Anything below ₹100 is `CARRIED_FORWARD`. Open nets (`DRAFT`, `CARRIED_FORWARD`, `FAILED`) roll into the next settlement through `carriedIntoId`.
  - Marking a settlement paid posts `SETTLEMENT_PAYOUT` for −net, linked to that settlement.
- **Payout account:** `OrgPayoutAccount` is encrypted with AES-256-GCM using `PAYOUT_ACCOUNT_KEY`. Only the last 4 digits are shown. The full number is decrypted only for the super admin bank file, and that export is logged. The edit form opens with the saved details; leaving the account number blank keeps the stored one.
- **Dues:** a balance that is negative for 4 runs in a row and above ₹500 raises a `BalanceDue`. The owner can also pay a negative balance at any time.
  - Payment goes through Razorpay (verify endpoint plus webhook) or is marked paid offline by a super admin.
  - Either way it posts `BALANCE_PAYMENT`.
- **COD cash refunds:** `ReturnRequest.refundTo` (`WALLET`/`CASH`).
  - Cash is allowed only when cash or UPI was actually collected at the door (`paymentMethod = COD` and `codCollectedVia` set).
  - Cash is paid only at handover, when the rider collects the item or the counter receives it. Any other refund path (keep, replacement fallback) goes to the wallet.
- **Paying from the balance:** one-off marketing purchases (extra promotions, AI image packs) accept `payWith: "BALANCE"`, which posts `PLAN_FEE` under an organization lock. Refunding such an order posts a reversal. Plan subscriptions stay on Razorpay.
- **Ledger queries:** `POST /ledger/entries/:id/query` creates a support ticket with no organization, so only Martly sees it, and alerts super admins.
- **API:** `routes/ledger/` (`index`, `settlements`, `platform`, `scope`), plus the contract in this doc's "What owners see" section.
- **Admin:** a Finance group with Ledger, Settlements, Payout account, and "Payouts (platform)": balances, queue, accounts to verify, adjustments and dues. Also added: an order and funded-by choice on the customer wallet adjust, and the cash refund cue on return detail.
- **Mobile:** More → Organization → Payments & payouts (`app/manage/finance/`), a Today payout card, `STAFF_FINANCE` notification routing, the refund-to picker on customer returns, the rider "Hand back ₹X cash" cue, the counter cash cue, and "Pay from balance" in the marketing plan.

### Martly commission (added 2026-10-20)

- **Rates** are set per organization by a super admin: `onlineCommissionPct` (default 4: 2% gateway plus 2% Martly) and `codCommissionPct` (default 2). Both include GST. They're on the organization edit page in admin, and owners see them read-only on Payments & payouts.
- **On delivery**, one `COMMISSION` entry (−) is posted with the sales, under the same hold (`services/ledger/commission.ts`):
  - the online rate applies to what was paid online;
  - the COD rate applies to cash or UPI collected and to the wallet part, since wallet money has no gateway cost;
  - the delivery fee is included; loyalty points and coupons are not, because the customer didn't pay them;
  - units handed back at the door first reduce the cash collected, and any wallet credit reduces the online and wallet parts in proportion.
  - So a pure COD order now posts an entry: ₹500 COD gives −₹10. This is how COD commission is recovered from payouts.
- **The order records** `commissionBase` and `commissionAmount` at delivery. Rate changes apply only to later deliveries.
- **Returns** post `COMMISSION_REFUND` (+) = refunded amount × the order's charged rate, capped at what was charged. This applies to wallet and cash refunds alike, so a cash refund now posts an entry.
- **Undo delivery** reverses the commission with the other delivery entries.
- **Statements** show the period's net commission and its GST share (18/118). The ledger has a Fees filter.
- **Not charged:** membership sales and Martly's platform coupon reimbursements.
- **Tested with curl:**
  - COD ₹176 → −₹3.52.
  - Wallet ₹264 → −₹5.28.
  - Online ₹264 with ₹88 handed back → −₹7.04, charged on ₹176.
  - A cash return of ₹88 → +₹1.76; a wallet return of ₹176 → +₹3.52.
  - Undo reverses the commission, and redelivery charges it again.
  - With a 3% rate, the next delivery is charged at 3%.
  - A rate of 25% is rejected, and an owner can't change rates.
  - Statement GST: ₹22.88 includes ₹3.49.

### Decisions that differ from the design above

- **Platform coupons:** there is no `Coupon.fundedBy`. A coupon with no organization is a platform coupon; that is the only case today.
- **Entry types:** only the types in use exist. `OPENING_BALANCE` was dropped because the ledger starts at zero. `BRAND_FUNDED`, `PLATFORM_FEE`, `TCS` and `TDS` will be added when they are built. `BALANCE_PAYMENT` was added.
- **Referral rewards:** both rewards are debited to the store of the referee's first delivery.
- **Reversals** of an entry still on hold keep its `availableAt`, so a sale and its undo always land in the same settlement.
- **Redelivery after an undo** posts entries with a fresh source id (`orderId:n`).
- **Membership verify** now takes the price from the Razorpay payment, not from the client's `amountPaid`, and rejects a reused payment id. Before this change, a replayed verify call created duplicate memberships and, with the ledger, would have credited money that was never received.
- **Large refund alert:** a fixed threshold of ₹1,000 (`LARGE_REFUND_ALERT`), sent by the scheduler sweep, not configurable per store.

### Tested (curl against a local API, pushes disabled)

- Wallet-paid delivery posts `SALE_WALLET` with a 72h hold. Undo posts a `REVERSAL`, and a second undo is refused. Redelivery posts fresh entries.
- Return refund to the wallet posts `RETURN_REFUND`. Wallet transactions carry `reason`, `organizationId` and `storeId`.
- A cash refund is refused on a wallet-paid COD order. On a cash-collected order, a drop at the store refunds in cash: no wallet credit and no ledger entry.
- Door hand-back on a wallet+COD order posts `SALE_WALLET` ₹633.20 and `DOOR_REFUND` −₹281.20, matching `amountDue`.
- Settlement: credits ₹552 and debits −₹264 give net ₹288, `DRAFT` without an account. Once the account is verified it becomes `APPROVED`. Mark paid posts the payout and zeroes the balance; a second mark-paid is a no-op.
- The statement renders through the signed link; a tampered signature gets 403.
- Four negative weeks raised a ₹700 due. Marking it paid offline posts `BALANCE_PAYMENT`, and the next run nets to 0.
- Paying from the balance posts `PLAN_FEE` and marks the order paid. When the balance falls short, the API returns 400 and the order is cancelled.
- A store manager sees the ledger for their stores only. They get 403 on settlements and on saving the payout account.
- The CSV export and the platform balances, queue, bank file, dues and accounts endpoints all respond.

### Needs manual verification

- Online (Razorpay) order delivered, giving `SALE_ONLINE`. Platform coupon on a COD order.
- Paying a due through Razorpay checkout in the app, and through the webhook.
- Membership purchase and upgrade through Razorpay. Verify now fetches the payment from Razorpay.
- Rider collecting a cash-refund return on the next order, with the cash cue in the deliver flow.
- All new admin and mobile screens on a device or browser. None were run during the build.

### Deploying

- Set `PAYOUT_ACCOUNT_KEY` on Railway (`openssl rand -hex 32`) before owners save bank details. Without it, saving returns 503. Keep the key: losing it makes the stored account numbers unreadable.
- Migration `20261020090000_store_ledger` backfills `wallet_transactions.reason` from descriptions, and the store and organization from the order.
