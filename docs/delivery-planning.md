# Delivery planning: slots → roster → trips → riders

A store decides **when** it delivers (slots), **who** delivers in each slot (the roster), and **how big** trips are (fleet settings). The system turns each batch of orders into balanced, locality-based trips. The manager confirms the suggested riders, and each rider starts their trip.

Phase 1, the engine and API, is built and described here. Phase 2 (manager screens) and Phase 3 (rider app) build on it.

## Concepts

| Term | Meaning |
|---|---|
| **Slot** | A delivery window on a weekday, e.g. Mon 17:00–19:00, with a booking cutoff and max orders (`DeliverySlot`, already existed) |
| **Roster** | The riders who work a slot every week (`SlotRider`), plus per-day changes such as a day off or an extra rider (`SlotRiderOverride`) |
| **Fleet settings** | `StoreDeliverySettings`: max orders per trip (8), max trips per rider per slot (2), Express batch size (3), Express max wait (10 min), auto-plan (off) |
| **Wave** | A batch planned together: one slot on one day, or the store's Express orders |
| **Trip lifecycle** | `PLANNED` (no rider) → `CREATED` (rider assigned) → `IN_PROGRESS` → `COMPLETED`, or `CANCELLED` |

**Slot capacity for customers:** the smaller of the slot's max orders and roster riders × trips per rider × orders per trip. A slot with no roster keeps its plain max orders, so stores that haven't set a roster keep taking orders.

## Planner (`apps/api/src/services/delivery/planner.ts`)

These are pure functions with unit tests in `planner.test.ts`, run by `pnpm --filter @martly/api test`.

1. **Which orders**
   - A slot wave takes every delivery order booked for that slot and day that isn't on a rider's trip. That includes pending, confirmed, preparing and ready orders, so planning can start before everything is packed.
   - The Express wave takes only orders that are ready.
2. **Grouping**
   - Orders with coordinates are swept by bearing around the store, starting after the widest empty arc so no neighbourhood is split.
   - Orders without coordinates follow, grouped by pincode.
3. **Balancing**
   - The number of trips is the order count divided by max orders per trip, rounded up, but never more than the fleet allows (roster × trips per rider, minus trips already assigned).
   - Sizes differ by at most one: 17 orders become 6, 6 and 5.
   - Orders beyond capacity are reported as overflow and stay unplanned.
4. **Stop order**
   - The planner orders stops nearest-first.
   - Then Google Routes (`optimizeWaypointOrder`) reorders them for the shortest round trip and records distance and duration on the trip.
5. **Area label:** each trip is named by its most common street and pincode, e.g. "Temple Road · 636903".
6. **Rider suggestions:** for each planned trip, the roster rider with the fewest trips in that wave, never above the per-rider limit.

**Re-planning:** replaces only `PLANNED` trips. Assigned and started trips are never touched.

**Automatic Express batching:** plans only new orders (`keepPlanned`), so a manager's edits to planned Express trips survive.

## Automatic planning (`apps/api/src/plugins/delivery-planning-scheduler.ts`)

Every minute, for each active store with **auto-plan on** (opt-in, off by default):
- **Slots:** once a slot's cutoff passes, and before it ends, the slot is planned **once**, provided it has orders and no trips yet. Orders placed after that wait for a manual re-plan.
- **Express:** ready orders are batched when there are at least the batch size, or when the oldest has waited longer than the max wait.

Auto-plan is opt-in because planned trips need the Phase 2 screens. Turn it on per store once its slots and roster are set up.

## API

| Method and path | Who | What |
|---|---|---|
| `GET /delivery-plan?storeId&date` | View orders / Dispatch / Delivery setup | The whole board for an IST day. Each wave has its slot, cutoff, capacity, booked count, roster, unplanned orders, and trips with stops, packing progress and suggested rider. Also returns settings and store riders. |
| `POST /delivery-plan/plan` `{storeId, date?, slotId?}` | Dispatch | Plan or re-plan a slot wave, or Express when `slotId` is left out |
| `GET / PUT /delivery-plan/settings` | View / Delivery setup or Manage riders | Fleet settings |
| `PUT /delivery-plan/slots/:slotId/roster` `{riderIds}` | Delivery setup or Manage riders | Weekly roster. Every rider must work at the store. |
| `PUT /delivery-plan/slots/:slotId/roster/override` `{riderId, date, working}` | Delivery setup or Manage riders | One day's change to a roster |
| `POST /delivery-trips/assign` `{assignments:[{tripId, riderId}]}` | Dispatch | Assign planned trips ("Assign all"), or reassign an unstarted one |
| `POST /delivery-trips/:id/move-order` `{orderId, toTripId \| null}` | Dispatch | Move a stop between unstarted trips, or back to the pool |
| `PATCH /delivery-trips/:id/start` | Dispatch or the trip's rider | Refused without a rider, or while any order is still being packed ("4 of 5 orders packed") |
| `POST /delivery-trips` | Dispatch | **Changed:** orders join the rider's **unstarted trip in the same wave** instead of creating a new trip. With `start`, the whole trip goes out, or nothing changes if it's blocked. |
| `GET /delivery-trips` | View | Leaves out `PLANNED` trips unless `includePlanned=true`, so the old board keeps working |

**Other changes:**
- **Cancelling:** a cancelled order (by staff or customer) leaves its trip if the trip hasn't started. A planned trip left empty is deleted; an assigned trip left empty is cancelled.
- **Coordinates at checkout:** orders keep the coordinates sent with the request. If there are none, the address is geocoded once (Google). A network failure doesn't block the order.
- **IST everywhere:** slot weekday, cutoff and estimated delivery time now use IST in checkout and slot availability. They used the server's clock before, which is UTC on Railway, so production cutoffs were 5½ hours off.

## Data and migrations

- `20261016150000_delivery_planning`: `TripStatus.PLANNED`, `TripWave`, the new trip columns (`riderId` becomes optional; `wave`, `deliverySlotId`, `slotDate`, planned distance and duration, `areaLabel`), `store_delivery_settings`, `slot_riders`, `slot_rider_overrides`.
- `20261016160000_delivery_auto_plan_opt_in`: auto-plan defaults to off.
- Existing trips become `EXPRESS` with their rider kept. Deleting a rider who has trips is still blocked.

## Seed

`cd apps/api && npx tsx prisma/seed-delivery-planning.ts`, after `seed-manage-users.ts`, sets up Harur Fresh Mart with:
- **Slots:** two a day (10–12 and 17–19, cutoff 60 minutes, max 40). The old 09–22 slots are switched off, not deleted.
- **Roster:** Harur Rider, Arun and Bala on every slot.
- **Settings:** 6 orders per trip, 2 trips per rider, auto-plan off.
- **Orders:** 14 for today's 17–19 slot (mostly ready, some still packing) and 5 for tomorrow's 10–12, spread over four neighbourhoods with coordinates. Re-running replaces them.

## Tested

- **Unit:** balancing, keeping neighbourhoods whole (including across the wrap-around), the pincode fallback, capacity overflow, nearest-first order, area labels and rider suggestions.
- **Scheduler:** with the cutoff moved into the past and auto-plan on, it planned 14 slot orders into 3 trips (5, 5, 4) labelled by area, with Google distances of about 10–12 km and 21–24 minutes. It also batched 2 waiting Express orders.
- **Manager flow:**
  - plain staff are refused the board
  - starting a planned trip says "assign a rider first"
  - "Assign all" uses the suggestions
  - starting with an unpacked order is blocked ("4 of 5 orders packed"); after moving it to the pool, the trip starts
  - re-planning keeps assigned and started trips and plans the leftover order into a new trip
- **Shortcut:** assigning two orders to the same rider one at a time builds one trip with 2 stops.
- **Cancellation:** cancelling an order on a planned trip releases it, and the empty trip is removed.
- **Capacity and roster:**
  - capacity is the smaller of 40 and 3 × 2 × 6, so 36
  - one rider off tomorrow brings capacity to 24
  - a roster containing a non-rider is rejected
  - the store manager can save fleet settings

## Rider API (Phase 3)

**Riders only see their own work**
- The RIDER role preset is now just "Deliver orders" (`DELIVERY_DELIVER`). "View orders" moved to the rider add-ons.
- A rider can't list store orders or trips. Existing riders pick this up on their next sign-in.

**Endpoints**

| Method and path | Who | What |
|---|---|---|
| `GET /delivery-trips/mine?date` | Deliver orders | The rider's day. **Trips** have store (address, phone, location), slot, area, and stops in order. Each stop has phone, address, location, instructions (`deliveryNotes`), slot window, estimated delivery time, items with images, payment, and **`amountDue`**: cash to collect, which is the total less wallet and loyalty, or 0 if paid or online. Failed attempts are listed per trip. The **summary** covers trips, trips done, delivered, failed, cash collected and cash still to collect. |
| `GET /rider-location/trips/:tripId/route` | The trip's rider, or staff of its store | The ETA and cumulative distance for each remaining stop in planned order, plus total and polyline. It routes from the rider's last shared position (`from: "rider"`), or from the store until they share one. Cached for about 60 seconds, and refreshed when the rider moves more than 300 m or a stop finishes. |
| `POST /rider-location` `{tripId, lat, lng, heading?, speed?}` | The trip's rider, while the trip is in progress | Shares the rider's position. This feeds customer live tracking and rider ETAs. |
| `POST /delivery-trips/:id/orders/:orderId/fail` `{reason, note?}` | The trip's rider, or Dispatch | Couldn't deliver. The order goes back to **Ready**, off the trip; a `DeliveryFailure` is recorded and the history gets "Delivery attempt failed: …". No push is sent. `OTHER` needs a note. The trip completes when no stops are left. |
| `GET /delivery-trips/summary?storeId&date` | View orders / Dispatch / Manage riders | The same day summary, per rider |
| `GET /riders?storeId` | Manage riders | Each rider now also includes `today`, the day summary |

**Shared helpers:** `amountDue()` and `handoverNote()` in `@martly/shared/order-flow` now subtract wallet and loyalty. `DELIVERY_FAILURE_LABELS` is in `@martly/shared/constants`.

**Removed:**
- The unused rider-only `GET /rider-location/my-trips` and `PATCH /rider-location/trips/:id/deliver`. The second skipped loyalty points and marking cash orders as paid. Delivery always goes through `PATCH /orders/:id/status`.
- The websocket `location:update` message. It accepted positions for any trip from any logged-in user, so anyone could fake a rider's position.

**Trip completion:** delivered and failed stops both call `stopFinished`. It completes the trip when nothing is left on the road, clears the live location, and sends `trip:stop_completed` so customer tracking refreshes. The deliver endpoint that sent it before has been removed.

**Board:** pool orders carry their latest `deliveryFailures` entry, so dispatch sees why an order came back.

**Tested with curl:**
- **Access:** the rider has only Deliver orders, and store orders and trips are refused (403).
- **Trips:** `/mine` returns 5 trips with phones, items and the correct amount due.
- **Starting:** blocked at "3 of 4 packed", and works after the unpacked order is moved off.
- **ETA:** comes from the store before location is shared (6, 7 and 13 min, 5.4 km), then from the rider.
- **Delivery:** a delivered stop counts its cash.
- **Couldn't deliver:** "Other" without a note is refused. A failure moves the order to Ready, records it and shows it in the pool. Failing a stop on someone else's trip is refused.
- **Summary:** the rider, the manager per-rider view and the Riders list agree.

## Screens

**Mobile (Manage persona)**
- **Delivery tab, for dispatchers:** the wave planner (`components/manage/delivery/plan/`).
  - Date bar, wave chips (Express and each slot), and a wave summary with cutoff, booked/capacity, today's riders (Working switches) and unplanned count.
  - **Plan trips / Re-plan / Assign all**.
  - Trip cards grouped Planned / Assigned / On the road / Done, each with area, stops, km and minutes, packed progress, suggested rider with Change, and Start (shows the reason when blocked).
  - Stops have Move…, open the order menu, and Couldn't deliver (on the road).
  - The unplanned list shows failed attempts and old orders sent out without a rider (open the order and use **Assign rider**).
- **Delivery tab, for riders, titled "Trips"** (`components/manage/rider/`):
  - date bar for history, and a day summary (delivered, failed, cash collected, cash still to collect)
  - trips with a header (slot, area, "3 of 5 delivered", cash on the trip, "~35 min left · back by 18:25")
  - **Start trip**, and a large **next stop** card (Call · Navigate · Couldn't deliver · Delivered)
  - the stop list with ETAs, ✓ and ✕ reasons, and a stop sheet with items and payment breakdown
  - **location sharing** while a trip is on the road, with a banner if location is off
- **More → Delivery setup → Riders & trips** (`components/manage/fleet/`): fleet rules (including auto-plan) and the weekly roster per time window and weekdays.
- **More → Riders:** each rider shows today's delivered, failed and cash collected.

**Admin**
- **Delivery Board** (`pages/delivery-board/`): the same wave planner, with a stops table, Move, Unplan, Couldn't deliver and failure tags.
- **Riders & Trips** (`pages/delivery-fleet/`): fleet rules and a roster grid (time windows × weekdays).
- **Riders list:** columns for delivered today, failed, cash collected and cash to collect.

**Test data:** run `seed-manage-users.ts`, then `seed-manage-orders.ts` (its out-for-delivery orders ride on a started Express trip with the first rider), then `seed-delivery-planning.ts`.

## Known issues and next steps

- **Harur Fresh Mart's stored location (12.244, 78.269) is about 30 km from Harur town (≈12.05, 78.48).** Distances and the sweep are measured from the store, so it should be corrected before real orders with geocoded coordinates are planned.
- **Auto-plan is opt-in per store** (Riders & trips → auto-plan). Turn it on once the store's slots and roster are set.
- **Riders must sign in again** to pick up the new rider permissions (Deliver orders only).
- **Location sharing only runs while the app is open** (foreground). Background tracking needs "Always" permission and app-store justification, and wasn't built.
