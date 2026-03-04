# Shoppable Recipes

Browse recipes with ingredients mapped to store products. One-tap "Add all to cart" drives basket size by letting users shop by meal.

## How It Works

### Data Model

- **Recipe** — title, slug, description, image, instructions (JSON array of steps), metadata (prep/cook time, servings, difficulty, cuisine, diet type), optional org scope, Tamil translations
- **RecipeItem** — links a Recipe to a Product with `displayQty` ("500g", "2 medium") and optional `note` ("finely chopped"). Unique constraint on `[recipeId, productId]`.

### Store-Aware Ingredient Mapping

When a customer views recipes for a specific store:
1. Each recipe ingredient (Product) is matched to the cheapest available StoreProduct variant in that store
2. Availability count and estimated total are computed per recipe
3. Unavailable ingredients are shown grayed out and cannot be added to cart

### Flow

1. **Home Feed** — "Shoppable Recipes" horizontal scroll (6 recipes) with "See All" link
2. **Recipe List** (`/recipes`) — 2-column grid with difficulty and diet type filter chips
3. **Recipe Detail** (`/recipe/:id`) — hero image, metadata chips, ingredient checklist, numbered instructions, floating "Add to Cart" bar
4. **Add to Cart** — checked available ingredients added as individual cart items. Store-switch confirmation if cart has items from a different store.

## API Endpoints

Base: `/api/v1/recipes`

### Admin CRUD (requires `authenticate`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | authenticate | List recipes (paginated, search by title, org-scoped) |
| GET | `/:id` | authenticate | Recipe detail with items + product info |
| POST | `/` | SUPER_ADMIN / ORG_ADMIN | Create recipe with nested items |
| PUT | `/:id` | SUPER_ADMIN / ORG_ADMIN | Update recipe, replace items if sent |
| DELETE | `/:id` | SUPER_ADMIN / ORG_ADMIN | Delete recipe (cascades items) |

### Store-Facing (public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stores/:storeId` | List recipes with availability summary. Filters: `difficulty`, `dietType`, `pageSize` |
| GET | `/stores/:storeId/:id` | Full recipe with store-enriched ingredients (pricing, availability) |

### Home Feed

`GET /api/v1/home/:storeId` now returns a `recipes` array (max 6) with availability counts and estimated totals.

## Admin Panel

Under **Marketing > Recipes** sidebar group:

- **List** — Table with title, cuisine, difficulty tag, diet tag, ingredient count, active toggle, edit/delete actions
- **Create/Edit** — Two-card layout:
  - Left: Recipe details (title, auto-slug, description, times, servings, difficulty, cuisine, diet, image URL, active toggle)
  - Right: Ingredients (product select + displayQty + note per row) and Instructions (numbered step text areas)

## Mobile Screens

| Screen | File | Description |
|--------|------|-------------|
| Home section | `app/(tabs)/index.tsx` | Horizontal scroll of RecipeCards in "Shoppable Recipes" section |
| Recipe list | `app/recipes.tsx` | 2-column grid with filter chips (difficulty + diet) |
| Recipe detail | `app/recipe/[id].tsx` | Full recipe view with ingredient checklist and add-to-cart |
| Recipe card | `components/RecipeCard.tsx` | 160px card with image, diet badge, metadata, availability pill, price |

## Seed Data

10 Indian recipes seeded via `apps/api/prisma/seed-recipes.ts`:

Masala Chai, Vegetable Pulao, Dal Tadka, Paneer Butter Masala, Poha, Curd Rice, Egg Bhurji, Aloo Gobi, Tomato Soup, Chicken Biryani

Run: `cd apps/api && npx tsx prisma/seed-recipes.ts`

## Verification Steps

### 1. API — Admin CRUD

```bash
# Get admin token
TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@martly.dev","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# List recipes
curl -s http://localhost:7001/api/v1/recipes?pageSize=5 \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d[\"data\"])} recipes, total: {d[\"meta\"][\"total\"]}')"

# Get single recipe
curl -s http://localhost:7001/api/v1/recipes \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; r=json.load(sys.stdin)['data'][0]; print(f'ID: {r[\"id\"]}, Title: {r[\"title\"]}, Items: {len(r.get(\"items\",[]))}')"
```

### 2. API — Store-Facing

```bash
STORE_ID="375d5737-069b-42f0-9791-1cc8390c0993"

# List with availability counts
curl -s "http://localhost:7001/api/v1/recipes/stores/$STORE_ID?pageSize=3" | python3 -c "
import sys,json
for r in json.load(sys.stdin)['data']:
    print(f'{r[\"title\"]}: {r[\"availableCount\"]}/{r[\"ingredientCount\"]} available, est total: {r[\"estimatedTotal\"]}')"

# Detail with enriched ingredients
RECIPE_ID=$(curl -s "http://localhost:7001/api/v1/recipes/stores/$STORE_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
curl -s "http://localhost:7001/api/v1/recipes/stores/$STORE_ID/$RECIPE_ID" | python3 -c "
import sys,json
r=json.load(sys.stdin)['data']
print(f'Recipe: {r[\"title\"]}')
for item in r['items']:
    avail = 'YES' if item['available'] else 'NO'
    price = item['storeProduct']['pricing']['effectivePrice'] if item.get('storeProduct') and item['storeProduct'].get('pricing') else 'N/A'
    print(f'  {item[\"product\"][\"name\"]}: {item[\"displayQty\"]} — Available: {avail}, Price: {price}')"

# Filter by difficulty
curl -s "http://localhost:7001/api/v1/recipes/stores/$STORE_ID?difficulty=EASY" | python3 -c "
import sys,json
for r in json.load(sys.stdin)['data']:
    print(f'{r[\"title\"]} ({r[\"difficulty\"]})')"
```

### 3. Home Feed

```bash
curl -s "http://localhost:7001/api/v1/home/$STORE_ID" | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']
recipes=d.get('recipes',[])
print(f'{len(recipes)} recipes in home feed')
for r in recipes[:3]:
    print(f'  {r[\"title\"]}: {r[\"availableCount\"]}/{r[\"ingredientCount\"]}')"
```

### 4. Admin Panel (Manual)

1. Start admin: `pnpm --filter @martly/admin dev`
2. Login as `admin@martly.dev` / `admin123`
3. Navigate to **Marketing > Recipes** in sidebar
4. Verify list shows 10 seeded recipes with correct tags
5. Click **Create** — fill in recipe details, add ingredients via product dropdown, add instruction steps
6. Click **Edit** on an existing recipe — verify all fields pre-populated including ingredients and instructions
7. Toggle **Active** on/off from list view

### 5. Mobile App (Manual)

1. Start mobile: `pnpm --filter @martly/mobile dev`
2. Login with phone `5555555555`, OTP `111111`
3. **Home screen** — scroll to "Shoppable Recipes" section, verify horizontal scroll of recipe cards
4. Tap **See All** — verify recipes list with 2-column grid and filter chips
5. Tap a filter chip (e.g., "Easy") — verify list filters correctly
6. Tap a recipe card — verify detail screen:
   - Hero image (or placeholder)
   - Metadata chips (prep time, cook time, servings, difficulty, cuisine)
   - Ingredient checklist with prices (available items checked, unavailable grayed)
   - Numbered instruction steps
7. Uncheck some ingredients — verify bottom bar updates count and total
8. Tap **Add X items** — verify items added to cart
9. Navigate to cart — verify recipe ingredients appear as individual cart items with correct prices
