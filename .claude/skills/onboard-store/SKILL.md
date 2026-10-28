---
name: onboard-store
description: Onboard a new store onto Martly prod. Asks for the store's details, then sets up the org, store, logins, logo, own brand, catalog, storefront, delivery, 4 AI hero collections and 5 cover banners, and launches it
argument-hint: <store name or the details you already have>
---

Onboard a new store onto **prod**. Same result as Admin → Onboard store (docs/store-onboarding.md), plus the store's own
brand, shared role logins, hero collections and cover banners.

**Given:** $ARGUMENTS

Prod access: `P="$(grep '^PROD_DATABASE_URL' apps/api/.env | cut -d= -f2- | tr -d '"')"` (standing OK). Keep each store's
files in `~/.martly/onboarding/<slug>/`, outside git and kept between sessions: `spec.json`, `spec.logins.json` (passwords)
and `covers.json`.

## 1. Intake: one question at a time

Start from scratch every time. Don't fill fields from memory or from earlier conversations; the arguments only name the
store. Ask the fields below **one per message**, in this order:
- Show progress, e.g. "(3/15)".
- Wait for the answer before asking the next one.
- Fields with fixed choices (size, meat/fish/eggs, delivery, defaults) use AskUserQuestion. The others are plain
  questions in chat.
- Check each answer as soon as it arrives, using the checks in step 2 (town right after the town, slug right after the
  slug, and so on).
- If an answer fails a check, say why and ask that question again before moving on.

| Field | Notes |
|---|---|
| Organisation name | Legal or business name |
| Store name | Shown to shoppers. Point out a likely typo |
| Own brand | The name on the store's own packs, e.g. "PSB". Optional |
| Store slug | `martlyshop.in/{town}/{slug}`, 2–30 chars `a-z0-9-`. Sree Ranga's is `sreerangastore` |
| Town | Must be a prod `towns` row |
| Size | Kirana → `KIRANA`, supermarket/medium → `SUPERMARKET`, large/hyper → `HYPERMARKET` |
| Google Maps link | For the map pin |
| Store phone | 10-digit mobile |
| Store address | As shoppers see it. Write `17\40` as `17/40`, and say you did |
| Owner name + mobile | The owner signs in by OTP on this mobile; may be the store phone |
| Logo | Local file path |
| Meat, fish & eggs? | No → leave out `"Meat, Fish & Eggs"` and `"Frozen Meat & Seafood"` |
| Other aisles not sold | Department, category or aisle names |
| Delivery | Home delivery with express, slots or both. Pickup is always offered at checkout. There's no store setting for pickup only yet, so ask the user before onboarding a pickup-only store |
| Different defaults? | Shown in step 3 |

## 2. Checks (run during intake, per answer)

- **Map pin:** run `curl -sIL '<link>' | grep -i '^location'` and read the coordinates from `@lat,lng` or `!3d<lat>!4d<lng>`.
  If the link only names a place, run `curl -sL` and look for `center=`/`@` in the page. If you still have none, ask
  for lat/lng. Never guess.
- **Town:** run `select id, slug, district, state from towns where name ilike '<town>'`. If it's missing, ask before
  inserting (name, slug, district, state).
- **Slug:** it must be free in that town: `select 1 from stores s join towns t on t.id = s.town_id where t.slug = '<town>' and s.slug = '<slug>'`.
- **Phones:** run `select email, role from users where phone = '<owner phone>'`.
  - A `CUSTOMER` login: ask, then set `"upgradeShopper": true`.
  - Staff of another store: stop and ask for another number.
- **Logins:** `<slug>@martlyshop.in` and `<slug>-manager|staff|rider@martlyshop.in` must not exist yet.
- **Aisle names:** each name in `catalog.exclude` must match a department, category or aisle on prod.
- **Organisation and brand:** run `select name from organizations where name ilike '%<name>%'` and
  `select name, organization_id from brands where name ilike '<brand>' or slug = '<brand-slug>'`. A match means the
  store may already be onboarded, or the brand name is taken (brand slugs are global). Ask before going on.
- **Logo:** run `cd apps/api && npx tsx scripts/logo-preview.ts <logo> <scratchpad>/logo`. Read both PNGs it writes and
  tell the user:
  - the background: `transparent` (kept), `removed` (Photoroom) or `kept` (opaque, Photoroom failed);
  - the size, which shows it's trimmed to the mark;
  - the brand and accent colours.

  Image viewers show transparent areas as black; the light/dark plates show what the app really gets. If the user wants
  changes (e.g. a tighter crop), they supply a new file.
- **Delivery slots:** with slots on, check that the template has some to copy:
  `select s.name, count(*), min(ds.start_time), max(ds.end_time) from stores s join organizations o on o.id = s.organization_id join delivery_slots ds on ds.store_id = s.id where o.is_template group by 1`.

## 3. Draft the content and confirm

- **What's live:** festivals and seasons for the store's region (TN unless the state says otherwise), live now or within
  their lead days:
  ```sql
  select name, kind, starts_at::date, ends_at from festival_events
  where is_active and ('TN' = any(regions) or 'ALL' = any(regions)) and ends_at > now()
    and starts_at - (lead_days || ' days')::interval < now() + interval '10 days' order by starts_at;
  ```
  Use the `ends_at` value as a festival banner's `endsAt`.
- **Banner targets:** category names come from
  `select c.name, d.name from categories c join departments d on d.id = c.department_id order by d.sort_order, c.sort_order`.
  Never reuse another store's category or collection ids; the script looks up names on prod.
- **4 hero collections:** briefs for the store's town and size. Example: South Indian breakfast, evening tea snacks,
  monthly staples and an occasion that's live. Give each a different palette from `MINT LAVENDER AMBER SKY ROSE SAFFRON LIME`;
  SAFFRON, ROSE, SKY and LIME are the least used by the fixed cards. Leave out meat or anything else the store doesn't sell.
- **5 cover banners** (`covers.json`, format in `apps/api/scripts/store-cover-banners.ts`):
  - English + Tamil copy. Only facts true for this store: express ETA, free-delivery threshold, staples, its own brand, a
    festival that's live, a hero collection.
  - Actions point at a category name or a collection title. Hero collection titles exist only after step 4, so update
    those targets then.
  - A festival banner gets `endsAt`.

Show one summary table and wait for **go**:
- every resolved field;
- the defaults the script uses, listed below;
- the 4 briefs;
- the 5 banner copies;
- the logins that will be made.

Defaults (Sree Ranga's):
- 5 km radius, ₹20 base fee (+₹10 per band), ₹99 minimum, free delivery over ₹299;
- 30-min express, 07:00–21:30, express + slots;
- MRP, stock 50;
- launch at the end.

## 4. Run on prod

```bash
cd apps/api
npx tsx scripts/onboard-store.ts ~/.martly/onboarding/<slug>/spec.json --prod
```

`spec.json`:

```json
{
  "organizationName": "…", "storeName": "…", "slug": "…", "townSlug": "dharmapuri", "size": "SUPERMARKET",
  "address": "…", "phone": "9xxxxxxxxx", "latitude": 12.1, "longitude": 78.1,
  "owner": { "name": "…", "phone": "9xxxxxxxxx" }, "upgradeShopper": false,
  "brandName": "PSB", "logoPath": "~/Downloads/logo.png",
  "delivery": { "express": true, "slots": true },
  "catalog": { "exclude": ["Meat, Fish & Eggs", "Frozen Meat & Seafood"] },
  "heroCollections": [{ "brief": "…", "palette": "SAFFRON" }]
}
```

`delivery` also takes `radius`, `minOrderAmount`, `freeDeliveryThreshold`, `baseDeliveryFee`, `expressEtaMinutes`, `opensAt`
and `closesAt`. `catalog` also takes `discountPct` and `openingStock`. `"launch": false` keeps the store hidden, and its
hero collections wait until it launches.

The script skips any step that's already done, so after a failure fix the spec and run it again:
1. Org, store, owner, delivery tiers and express.
2. Logo and brand.
3. Role logins.
4. Express/slots on or off.
5. Catalog: loose staples get suggested prices.
6. Storefront copy from Martly Template.
7. Readiness.
8. Launch.
9. Hero collections. They come after launch because the curator reads live stores' shelves.

"Every essential aisle stocked" lists the aisles you left out. That's expected.

The catalog shows only each aisle's likely products at launch (kirana 4, supermarket 10, large 25 per aisle; override
with `catalog.likelyPerAisle`). The rest are listed hidden, as suggestions. Tell the owner the follow-up:
1. Manage → Stock check: confirm what they carry (department, brand, then sizes).
2. Then Price review.

If the curator refuses a brief, reword it and re-run. Then read each collection's products and check they fit.

Prod runs Postgres 18 and the local DB runs 14, so SQL that works locally can still fail on prod. Example: PG18
rejects `ORDER BY false`. If a step fails on prod with a database error:
1. Fix the code properly.
2. Typecheck.
3. Re-run the script; finished steps are skipped.
4. Tell the user the fix needs an API deploy if the app uses that code too.

## 5. Banners

```bash
npx tsx scripts/store-cover-banners.ts paint  ~/.martly/onboarding/<slug>/covers.json --prod
npx tsx scripts/store-cover-banners.ts insert ~/.martly/onboarding/<slug>/covers.json --prod
```

Before `insert`, look at every painted image (English and Tamil). Download them and make two contact sheets, then read both:

```bash
D=<scratchpad>/banners; mkdir -p $D && cd $D
jq -r '.[] | .key as $k | (.imageUrls // {en: .imageUrl}) | to_entries[] | "\($k)-\(.key) \(.value)"' ~/.martly/onboarding/<slug>/covers.painted.json | while read n u; do curl -s -o $n.webp "$u"; done
montage $(ls *-en.webp *-ta.webp | sort | head -6) -tile 2x3 -geometry 800x533+6+6 sheet1.png
montage $(ls *-en.webp *-ta.webp | sort | tail -n +7) -tile 2x2 -geometry 800x533+6+6 sheet2.png
```

Check each image:
- the text is spelled right in both languages;
- the facts are true for this store;
- the scene fits. For a bad
one, delete its entry from `covers.painted.json`, adjust the scene or copy, and paint again. Only missing covers are
repainted.

## 6. Verify and report

- `curl -s https://api.martly.quartex.in/api/v1/home/<storeId>/sections`: the hero carousel shows Right now + the 4
  collections, and the 5 banners are there.
- Sign in with the manager's login at `POST /auth/login`.
- `curl -s https://www.martlyshop.in/<town>/<slug>`: the web shop shows the store name, its address and the banner files
  (`<slug>-<key>-en-…`). Share the `www` address: the bare `martlyshop.in` only forwards its home page (GoDaddy
  forwarding), so deep links without `www` return 404.
- Report:
  - the shop URL (`https://www.martlyshop.in/<town>/<slug>`);
  - the store id;
  - the 4 logins and passwords from `spec.logins.json`;
  - catalog counts;
  - hero titles;
  - readiness;
  - what's next: the store's own branded products, and its own pack artwork if it packs staples. For the pack
    artwork, follow "A new store's pack" in docs/store-packs.md.
- Update the store-onboarding memory with the store (id, slug, size, owner phone, date).
