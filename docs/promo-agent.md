# Promo agent

A store owner types or says a one-line request ("paneer 5% off", "fresh fruits", "buy natural soap"), in English or Tamil. An agent turns it into a promo:
- a 3:2 home banner in English and Tamil, with the text set into the art;
- a curated list of products behind it;
- optionally, a time-limited discount;
- a push notification.

A store owner's request always launches by itself and notifies customers (one promotion credit pays for all of it; see `docs/store-plans.md`). Martly's team can instead preview the draft and launch it, or tick "Launch automatically".

## Flow

1. **Create**: `POST /promos { brief, autoLaunch, notify, organizationId? }` stores a DRAFTING promo and returns at once. SUPER_ADMIN must pass `organizationId`; for store users `autoLaunch` and `notify` are always on.
2. **Draft** (in-process background job, `services/promo/draft.ts`, about 1–2 minutes):
   - **Agent** (`agent.ts`, `claude-sonnet-5-5`, SDK tool runner, at most 14 turns) uses these tools (`tools.ts`). The catalogue tools run against the org's reference store, i.e. the active store with the widest catalogue:
     - `search_products`, which uses the app's product search;
     - `list_subcategories` and `browse_subcategory`;
     - `find_on_sale`;
     - `submit_promo` or `give_up` to finish.
   - **Rules `submit_promo` enforces in code**, rather than leaving them to the prompt:
     - Only product ids the agent was shown, and 6–24 distinct products.
     - The discount must be a number written in the brief. The agent never invents or adjusts one.
     - A percentage above `Organization.promoDiscountCap` (default 20, set by SUPER_ADMIN on the organisation) fails the promo with that reason.
   - **Relevance check** (`judge.ts`, `claude-haiku-5-5`) drops off-topic products. Fewer than 6 left → FAILED.
   - **Banner**: `buildBannerSet` (shared with seasonal curation) paints EN and TA banners and proofreads them.
   - **Save**: an inactive `Collection` (kind `PROMO`, source `AGENT`) with the items. The promo becomes READY.
   - Every step is appended to `Promo.agentLog`. The admin page polls `GET /promos/:id` every 2 seconds.
3. **Launch**: `POST /promos/:id/launch` runs as one transaction:
   - creates a `HERO_CAROUSEL` banner pointing at the collection;
   - activates the collection;
   - applies the discount;
   - sets `startsAt` = now and `endsAt` = now + `durationDays` (7 unless the brief says otherwise).
4. **Push** (if `notify`): a `NotificationCampaign` with type PROMOTIONAL, the EN banner image and `data.collectionId`.
   - Sent to `ALL_CUSTOMERS`, meaning customers who have ordered from the org.
   - At most one promo push per org per 24 hours.
   - A failed push is logged on the promo; it doesn't undo the launch.
5. **End**: either End now (`POST /promos/:id/end`) or `plugins/promo-scheduler.ts` every 5 minutes after `endsAt`. Ending:
   - restores the discounts;
   - deactivates the banner and collection.
6. **Discard**: `DELETE /promos/:id` works on READY or FAILED promos. `PATCH /promos/:id/items` trims products before launch.

## Discounts (what happens to the listed paneer)

- **Base price:** never touched. Launch writes `discountType/Value/Start/End` on every active `StoreProduct` of the promo's products across the org's ACTIVE stores. Pricing (`services/pricing.ts`) and the deals queries already respect the dates, so the sale price **switches off by itself at `endsAt`**, even if no job runs.
- **A listing that already has an equal or bigger discount during the window is left alone.** This compares percentage equivalents and counts the variant-level discount the store discount would hide.
- **Overwritten discounts** are saved in `PromoPriceChange` and put back on end. A restore only happens where the promo's own values are still in place, so a manual edit made during the promo wins.

## Mobile

- `app/collection/[id].tsx` shows the banner (language-aware, never overlaid) and the in-stock products from `GET /collections/:id/products?storeId=`.
- These all open it:
  - COLLECTION banners (home and category);
  - promo pushes (`data.collectionId` in `lib/notification-helpers.ts`);
  - seasonal banners. These used to land on an unfiltered search screen.
- PROMO collections never appear as home rails or in the admin Collections list; they're managed under Marketing → Promos.
- Home carousel banners with equal `sortOrder` show newest first, so a fresh promo leads.

## Tested (local DB, Demo Grocers, 2026-10-14)

Drafts were run through `runDraft` directly with a local script, because the HTTP layer needs an admin login (see below).

| Brief | Result |
|---|---|
| paneer 5% off | READY in 60s: 12 paneer products (Amul, Mother Dairy, Milky Mist, fresh/malai/frozen), EN+TA banners, "Paneer 5% Off" |
| ghee products | READY in 68s: 15 ghee products, no discount |
| fresh fruits | READY in 95s: 14 fruits, juices/dry/cut fruit excluded |
| buy natural soap | READY in 100s: 16 herbal/neem/sandal bars, detergents excluded |
| daily deals | FAILED in 7s: nothing in stock is discounted locally, and it won't invent deals |
| paneer 50% off | FAILED in 17s: "A 50% discount is above this organisation's 20% cap". Before the fix it silently used 20%. |

Launch / end on "paneer 5% off":
- **Launch:** 253 listings across 9 stores got 5%.
  - A listing pre-set to 10% was kept.
  - A listing at 2% until next month was raised to 5%.
- **Pricing:** the collection endpoint showed ₹43 → ₹40.85 with `discountActive`.
- **Home feed:** the banner led the carousel, and no promo rail appeared.
- **End now:** the 2% listing got its original discount and end date back. No listing stayed at 5%.
  - The banner and collection were deactivated, and the collection endpoint returned 404 "This offer has ended".
  - Ending twice returns 409.
- **Push:** the ghee launch with notify on logged "No push sent: this organisation has no customers yet". Locally nobody has ordered.
- **Unauthenticated:** `/promos` calls return 401.

## Needs manual verification

- **Admin in a browser:** create → progress → preview → remove a product → Launch → End now, as an ORG_ADMIN and as a SUPER_ADMIN (who must choose an organisation).
- **Mobile:** tap the promo banner → collection screen (EN and TA) and pagination. Also tap a promo push.
- **A real push:** this needs an org with customers who have ordered.
- **The scheduler ending a promo at `endsAt`:** End now is tested; the scheduled path calls the same `endPromo`.
- **"Manual edit wins" on restore:** the code path exists but hasn't been exercised.
