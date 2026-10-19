# In-app notifications

Every notification is a row in `notifications`, sent live over the websocket (`notification:new`) and as an FCM push.
`sendNotification` in `apps/api/src/services/notification.ts` does all three and never throws.

## Audiences

Customer notifications and staff alerts share one table. The type decides which inbox a row belongs to
(`STAFF_NOTIFICATION_TYPES` in `packages/shared/src/constants/notifications.ts`):

- **Staff:** `NEW_ORDER`, `STAFF_ORDER`, `STAFF_STOCK`, `STAFF_DELIVERY`, `STAFF_SERVICE`, `STAFF_MARKETING`, `STAFF_TEAM`
- **Customer:** everything else

Where each inbox is shown:

- `GET /notifications?audience=staff|customer` lists one inbox.
- `GET /notifications/unread-count` returns `{ count, staff, customer }`.
- `PATCH /notifications/read-all?audience=` marks one inbox read.
- Mobile: the Home bell shows the customer inbox, and the Manage header bell (`components/manage/ManageHeader.tsx`) shows staff alerts.
- Web admin: the header bell shows staff alerts, with a toast and a beep for new orders.

## Who receives staff alerts

`notifyStaff(fcm, prisma, storeId, audience, alert)` in `apps/api/src/services/notify/staff.ts` (or `notifyOrgStaff` for
organisation-wide work):

- **Recipients:** store members holding any of the listed permissions, plus `userIds` (a rider, the creator of a draft).
- **Actor:** the person who caused the event is excluded.
- **Owners (ORG_ADMIN):** they receive only escalations (`escalation: true`), or an alert that would otherwise reach nobody.
- **Sound:** all staff alerts play the alert sound.

The escalations are:

- An order still not accepted or packed at twice the threshold.
- A payment that arrives for a cancelled order.
- A scheduled campaign that fails, or a promo whose scheduled launch fails.
- A failed delivery with no new trip after 30 minutes.
- A store rating of 2 stars or less.

## Taps

`data.screen` plus its id param decides where a tap lands, through `apps/mobile/lib/notification-helpers.ts` and
`apps/admin/src/components/notifications/helpers.ts`. Order refs use `formatOrderRef` (`#3F9A12BC`) and amounts use
`formatINR`. Both are in `services/notify/copy.ts`.

## Events

### Customer

- **Order status** (`sendOrderStatusNotification`):
  - Pickup and delivery have their own wording.
  - A cancellation says who cancelled it, the reason and where the refund went.
  - It fires on single status changes, bulk status changes, payment confirmation and trip start.
- **Order placed** (COD or wallet), and **payment failed** (from verify and the webhook, sent once per payment).
- **Unpaid online order expired:** cancelled after 30 minutes.
- **Late payment on a cancelled order:** refunded to the original payment method.
- **Delivery:** rider assigned, rider nearby (under 1 km, once), delivery attempt failed, delivery slot changed or deleted.
- **Returns:** approved or declined (with the note).
- **Support:** a staff reply or a resolved ticket. Also: the store replied to your review, or your review was not published.
- **Wallet and loyalty:**
  - Wallet: recharge, refunds, admin adjustments.
  - Loyalty: earned on delivery or review approval, returned when an order is cancelled, adjusted by staff.
- **Membership:** welcome, ending in 3 days, ended (only ends from the last 3 days are announced).
- **Referral:** a friend joined with your code, and your code was applied.
- **Subscription:** created, cancelled, skipped (stock or wallet), partial, placed, failed.
- **Wishlist:** back in stock or a price drop of 5% or more, checked daily at 10:00 IST at the store the item was saved from.
- **Store unavailable or reopened:** to customers with open orders or active subscriptions.
- **Promotions:** promo launch (to the stores it runs in), brand campaign live, seasonal collection live (09:00–21:00 IST)
  and the reorder nudge.
  - These are capped at one automatic promotional push per customer per day (`promotionalAllowed`).
  - Manual campaigns are not capped.

### Staff

| Event | Recipients |
|---|---|
| New order (express is flagged) | ORDERS_PROCESS |
| Customer cancelled (stop packing) | ORDERS_PROCESS |
| Order not accepted 10 min / not packed 20 min / still packing 30 min (only within 60 min of a scheduled slot) | ORDERS_PROCESS; owners at 2× |
| Packed delivery order with no trip: batched per store, plus a single alert at 20 min | ORDERS_DISPATCH |
| Slot full | DELIVERY_CONFIG, ORDERS_DISPATCH |
| Slot auto-planned / over capacity | ORDERS_DISPATCH |
| Trip assigned, reassigned or cancelled; stop added or removed | the rider |
| Delivery failed; trip complete (with COD to collect); rider offline for 5 min | ORDERS_DISPATCH |
| Tomorrow's subscription orders placed or skipped | ORDERS_PROCESS |
| Low or out of stock (items sold in the last 30 days, threshold `lowStockThreshold` or 5) | STOCK_RECEIVE, LISTING_AVAILABILITY |
| Stock count submitted → approvers; approved, rejected or recount → the counter | STOCK_APPROVE / creator |
| Catalog drafts ready or failed (batched per creator) | creator |
| Return requested | RETURNS_HANDLE |
| Support ticket created | SUPPORT_HANDLE |
| Review needs approval / low rating; low store rating | MARKETING_MANAGE / STORE_SETTINGS |
| Campaign sent or failed; promo ready, live, failed or ended; brand campaign scheduled | creator / MARKETING_MANAGE |
| Brand campaign needs approval | SUPER_ADMIN |
| Added to or removed from a store; role or access changed | the user |
| Marketing plan renewal | owners |

Schedulers: `order-sla-scheduler` (1 min), `delivery-alerts-scheduler` (1 min), `stock-alerts-scheduler` (5 min),
`membership-scheduler` (1 h), `wishlist-alert-scheduler` (daily). Each alert is claimed once with `alertOnce(key)` (the
`alert_once` table), so re-scans don't repeat it.

## Local development

Running the API locally against a prod-synced database with Firebase credentials pushes to real customers' phones.
The schedulers act on real orders. When starting a local API, either:
- `DISABLE_PUSH=true` saves rows but pushes nothing, or
- `PUSH_ONLY_USER_IDS=<id>,<id>` pushes only to those accounts (e.g. your own phone).

## iOS push tokens

FCM needs an FCM registration token. Before 2026-10-19 the app registered `getDevicePushTokenAsync()`, which on iOS is a
raw 64-character APNs token that FCM rejects ("not a valid FCM registration token"), so iOS pushes never arrived. The app
now registers `getToken(getMessaging())` from `@react-native-firebase/messaging`. The API deletes rejected APNs tokens on
the next send. Verified on an iPhone: background pushes for each order status arrive.

Tapping a push: expo-notifications only fills `content.data` for Expo-format pushes on iOS, so an FCM push's fields
(`screen`, `orderId`, …) arrive in `request.trigger.payload`. `notificationResponseData()` in `lib/notifications.ts`
reads whichever is present; `_layout.tsx` uses it for the cold-start and running-app tap handlers. Verified on an iPhone:
tapping an order push with the app closed opens that order.

## What was tested (2026-10-18, local, `DISABLE_PUSH=true`)

- **Order flow:**
  - Order placed → customer "Order placed" + NEW_ORDER to manager and staff; owners not alerted.
  - Pickup CONFIRMED → PREPARING → READY wording.
  - Customer cancel → the customer is told, and staff get "stop packing".
  - Store cancel with a note → "cancelled by the store: note".
  - Bulk CONFIRMED → one notification per order.
- **Wallet recharge:**
  - A tampered `amount` is ignored and the recorded amount is credited.
  - A replayed verify credits once, and a bad signature is rejected.
- **Late payment on a cancelled order:** the webhook marks it PAID, tries the refund and escalates to finance and owners. A replay does nothing.
- **Slow orders:**
  - Backdated CONFIRMED orders → 25 min alerts staff, 45 min also alerts owners.
  - An unpaid online order at 35 min → cancelled + customer told.
  - No repeats on later ticks.
- **Inbox filter:** staff vs customer filtering, the unread split and mark-all-read by audience.
- **Stock scan:** an item below threshold → "1 item running low". The SQL bug found here is fixed.
- **Wishlist:** restock → "Back in stock", and the snapshot is refreshed.
- **Returns:** the request goes to owners (nobody holds RETURNS_HANDLE) and the rejection to the customer with its note.
- **Delivery:**
  - Trip started → "New trip" to the rider and "Out for delivery" to the customer (no duplicate "Rider assigned").
  - Rider within 1 km → "nearby" once.
  - Failed delivery → customer + dispatch, then "Trip complete · 0 delivered, 1 failed".
- **Reviews:** a 1★ review → moderation alert; a store reply → customer.
- **Store status:** SUSPENDED → one notice per customer naming the latest order and counting the others.

## Needs manual verification

- **On a device:**
  - The Manage bell badge.
  - The customer bell showing customer notifications only.
  - Tap routing for each screen key.
  - One foreground banner, not two.
  - A staff banner while in the shop persona.
- **Web admin bell:** dropdown, toast, the NEW_ORDER beep (browsers allow audio only after a click), and the route mapping.
- **Not run end to end:**
  - Support ticket creation (through the AI chat).
  - Stock count submit, approve, reject and recount.
  - Catalog draft batches.
  - Membership purchase and expiry.
  - Referral apply.
  - Subscription scheduler summaries.
  - Promo and brand-campaign launches.
  - Seasonal announcements.
  - Team changes.
  - Slot full and auto-plan.
  - Stale rider.
- **Real FCM delivery:** the collapse key replaces repeated order pushes in the tray.
- **Deploying to prod:**
  - The order SLA scheduler cancels online orders left unpaid for 30 minutes. On its first run that includes up to a day of backlog.
  - Slow-order alerts only look 6 hours back.
