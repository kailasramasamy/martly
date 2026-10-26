# Store onboarding

A Super Admin sets up a new organisation and its first store in one wizard: **Admin → Onboard store**. The store is
proposed a South-India-first catalog for its region and size, gets its Home copied from a template organisation, and
stays **PENDING** (hidden from shoppers) until the final Launch step.

## Flow

The wizard (`apps/admin/src/pages/onboarding/wizard.tsx`) has six steps. The step is in the URL (`?step=`), so a
reload or a later visit resumes there. Opening a store without `?step` jumps to the first step it still needs.

1. **Business & team**: organisation name, owner name, 10-digit mobile, optional email and admin-panel password.
   Nothing is saved until the store is created. Once it exists, this step also has the **Team** card (see Logins below).
2. **Store**: place search or typed lat/lng, address, state, district, delivery radius, fee, free-delivery
   threshold, minimum order, express ETA, hours, logo. **Create store** runs `POST /onboarding` in one transaction:
   - an organisation, with `festivalRegions` set to the state's region;
   - a PENDING store;
   - delivery tiers covering 0 → radius (fee rising ₹10 per band);
   - the express config;
   - the owner and their `UserStore` (ORG_ADMIN).

   If the phone already belongs to a shopper, the wizard asks before turning that account into the owner's login
   (`upgradeShopper`). Their orders and wallet stay. A phone held by other staff is refused (409).
3. **Region & size**: the region comes from the state (`STATE_TO_REGION`; Puducherry counts as TN). The size can be:

   | Size | Aisle tiers | Brands per aisle | Products per aisle |
   |---|---|---|---|
   | Kirana | Essential | 3 | 8 |
   | Supermarket | Essential + Everyday | 6 | 25 |
   | Large supermarket | all | 12 | 60 |

4. **Catalog**: totals, then an aisle tree (department → category → aisle) with checkboxes, and the chosen aisle's
   brands (toggle off, or add one from "Also in this aisle") and products. The per-aisle caps can be overridden.
   - **Apply** lists every proposed size that has an MRP, at MRP less the discount % with the opening stock
     (recorded through `recordOpeningStock`).
   - Re-applying syncs the listings with the proposal: sizes no longer proposed are removed, new ones are added,
     and existing prices and stock stay.
   - The rules are saved on `Store.catalogRules`, so the step reopens with them.
   - **Needs a price** lists loose produce and staples with no MRP. Prices entered there are listed through
     `/store-products/bulk`.
5. **Storefront**: pick a template organisation (`Organization.isTemplate`) and the parts to copy. Re-running
   replaces the earlier copy.
6. **Review & launch**: the readiness checklist. Each failing item links to the step that fixes it. **Launch**
   sets the store ACTIVE, stamps `Store.launchedAt` and sends `notifyStoreStatusChange`. Launched stores stay on
   the Onboard store page under **Launched**. A launched store can't be launched again (409).

## Logins

Everyone signs in to the Martly app with an OTP on their mobile. An email **and** password (8+ characters) also lets them
sign in at the admin panel. A password without an email is refused, since the admin panel needs both. With no email, the
login gets a placeholder `<phone>@phone.martly.app` and a random password, so it is OTP only.

- **Owner**: ORG_ADMIN, set up with the store. Setting a password later from step 1 replaces the old one; leaving it
  blank keeps it.
- **Team** (`services/onboarding/team.ts`): store managers, staff and riders, each linked to the store with their role.
  - The phone belongs to a shopper: the wizard asks before turning that account into a staff login. Their orders and
    wallet stay.
  - The phone is staff of the same business: they are added to this store too.
  - Any other login on the phone (another business, an owner) is refused (409).
  - Removing someone takes them off the store. A login left with no store goes back to a plain shopper account; nothing
    is deleted.
  - Team changes are allowed only before launch. After launch the owner manages staff in the app.

## Catalog proposal

`services/onboarding/catalog-proposal.ts`, built on candidates from `catalog-candidates.ts` (one SQL query):

- **Candidates**: active, non-draft master products with an image, in aisles whose `Subcategory.tier` the size
  includes, plus aisles added by hand.
- **Brand eligibility**: `Brand.regions` contains `ALL`, contains the store's region, or is empty. Brands added by
  hand are always eligible. Unbranded products always count.
- **Brand ranking within an aisle**: the score is the sum of:
  - `popularity`;
  - +50 if the region is the brand's home (first entry in `regions`), +20 if it's another listed region;
  - sales from the last 90 days, capped at +30;
  - +1000 if added by hand.

  Unbranded products score 50.
- Products are picked round-robin across the top N brands, up to M per aisle. Every size of a picked product is
  proposed.

Data that drives it, reviewed as CSVs and loaded by `prisma/seed-onboarding-data.ts`:

- `prisma/data/brand-regions.json`: 727 brands (643 national, 84 regional). Low-confidence rows are in
  `brand-regions-review.csv`.
- `prisma/data/subcategory-tiers.json`: 478 aisles (132 Essential, 235 Everyday, 111 Niche & premium). Low-confidence
  rows are in `subcategory-tiers-review.csv`.

Edit the JSON and re-run the seed to change either. New brands and aisles default to "no region" (eligible
everywhere) and Everyday.

## What the storefront copy takes, and what it leaves

| Copied | How |
|---|---|
| Collections (+ items, tiles) | STANDARD, not ended, not festival, no promo. Items pruned to what the store lists; dropped under 4 items unless it has tiles |
| Home sections | Collection ids remapped (incl. HERO_CARDS cards and rightNow); sections pointing at a dropped collection, or a BRAND_CARD of the template's own brand, are skipped; configs re-validated |
| Banners | Plain STORE banners only; brand campaigns, promos and banners for the template's own brand stay behind |
| Membership plans, loyalty, referrals | Copied as configured |
| Delivery slots | From a template store that has slots |

Not copied: orders, coupons (codes are global), promos and price changes, store posts and picks, the template's own
brand and products, staff, ledger and billing.

## Readiness checks

Required: owner can sign in by OTP, map pin set, delivery tiers cover the radius, express or slots, size chosen,
products in stock.
Optional: staff can sign in, every essential aisle stocked, store logo, Home layout copied.

## API

All `SUPER_ADMIN`, under `/api/v1/onboarding` (`routes/onboarding/index.ts`):

| Endpoint | |
|---|---|
| `GET /` | Stores still PENDING plus stores launched from the wizard (`Store.launchedAt`), with progress |
| `GET /templates` | Template organisations |
| `POST /` | Create org + store + owner |
| `GET /:storeId`, `PATCH /:storeId` | Details for the wizard / edits from steps 1–3 (incl. the owner's password) |
| `GET /:storeId/team`, `POST /:storeId/team`, `DELETE /:storeId/team/:userId` | The store's managers, staff and riders |
| `POST /:storeId/catalog/proposal` | The proposal for the given rules; `subcategoryId` adds that aisle's products and other brands |
| `POST /:storeId/catalog/unpriced` | Proposed sizes without an MRP |
| `POST /:storeId/catalog/apply` | Sync the listings with the proposal |
| `POST /:storeId/storefront` | Copy from a template (needs listings) |
| `GET /:storeId/readiness` | The checklist |
| `POST /:storeId/launch` | Make the store ACTIVE |

## Tested (local, 2026-10-26)

- API with curl, TN Supermarket:
  - **Proposal**: 365 aisles, 451 brands, 5,333 products, 8,360 sizes; about 0.5 s per call.
  - **Apply**: 7,745 sizes listed in 3.4 s. Re-applying with Pasta excluded removed 34. 615 sizes need a price.
  - **Storefront copy**: 17 collections (4 dropped), 36 sections (4 skipped), 14 slots, 3 membership plans. A re-run
    replaced the earlier copy, and nothing points at template ids.
  - **Launch**: the store appears in `/stores/nearby`, and its Home renders 23 sections; each section the template
    has but the store doesn't has a reason. A second launch returns 409.
  - **Shopper upgrade**: both paths (confirmed, and refused without confirmation).
- Kirana / Supermarket / Large supermarket proposals compared; Tamil Nadu brands (Aachi, Sakthi, GRB, Aavin) rank
  first in TN.
- Admin wizard walked end to end in headless Chrome, with a screenshot of every step: create → size → catalog
  (aisle panel, apply) → storefront copy → review. Reopening without `?step` resumes at the right step.
- Logins (API with curl, then the browser):
  - A password without an email is refused.
  - With both, the owner and a store manager sign in at the admin panel. Changing the owner's password later works too.
  - OTP-only staff can be added. Adding the same person twice is refused, and so is adding the owner's phone as staff.
  - A shopper's phone asks for confirmation first. Removing that person turns the account back into a shopper.
  - The readiness check counts the team.
- Fixed during the walk: finishing a step no longer jumps the page ahead when the URL had no `?step`.

## Check by hand

- The place search and the map preview in a real browser. The map needs WebGL, which headless Chrome lacks, and the
  search needs the Google key.
- Logo upload on the Store step.
- Owner OTP login on the phone after launch, using a real number.
- Prices for loose items: enter a few, then **List priced**.
- Review the two CSVs before loading the data on prod.

## Seeds

- `npx tsx prisma/seed-onboarding-data.ts` loads brand regions and aisle tiers (set `TARGET_DATABASE_URL` for prod).
- `npx tsx prisma/seed-onboarding-demo.ts` (local only) creates "Demo Sree Ranga Stores", a TN Supermarket at the
  Catalog step.
