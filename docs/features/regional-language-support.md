# Regional Language Support

## Overview

Multi-language support for product names, descriptions, and category names — starting with Tamil. Users can switch languages in the app to see translated names as primary text with English as a subtitle. Search works in regional languages. Designed to extend to Kannada, Telugu, and Hindi.

## Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `ta` | Tamil (தமிழ்) | Active — all products & categories translated |
| `kn` | Kannada (ಕನ್ನಡ) | Schema ready, no translations yet |
| `te` | Telugu (తెలుగు) | Schema ready, no translations yet |
| `hi` | Hindi (हिन्दी) | Schema ready, no translations yet |

## How Translation Works — End to End

### 1. Storage

Every product and category has an optional `translations` JSON column in PostgreSQL. This is a flat key-value map where the key is a language code (`ta`, `kn`, `te`, `hi`) and the value is an object with `name` and optionally `description`.

### 2. Admin Writes Translations

When an admin edits a product or category in the admin panel, there's a "Translations" card with tabs for each supported language. The admin enters the translated name/description and saves. The form sends the `translations` field as part of the PUT request. The API stores it as JSONB in PostgreSQL.

### 3. Search Indexing (Automatic)

When a product is saved (create or update), a PostgreSQL trigger (`update_product_search()`) fires automatically. It:
- Reads the `translations` JSONB column
- Extracts all translated names across all languages
- Concatenates them into `search_text` (used for trigram/ILIKE matching)
- Adds them to `search_vector` using PostgreSQL's `'simple'` dictionary (used for full-text search)

This means: the moment you save a Tamil name in admin, it becomes searchable in Tamil — no manual indexing step needed.

### 4. API Serves Translations

All API endpoints that return products or categories include the `translations` field. The mobile app receives the full translations object alongside the English name.

### 5. Mobile App Displays Translated Names

The mobile app has a `LanguageProvider` context that tracks the user's selected language. Every component that displays a product or category name calls `getLocalizedName(item)`, which:
- Checks if a regional language is active
- Checks if the item has a translation for that language
- Returns the translated name if available, otherwise falls back to English
- Shows the English name as a smaller subtitle when displaying a translated name

### Data Model

Translations are stored as a JSON column on `Product` and `Category` tables:

```json
{
  "ta": { "name": "துவரம் பருப்பு", "description": "சிறந்த தரம்" },
  "kn": { "name": "..." }
}
```

- Field: `translations Json? @map("translations")` on both models
- Validated by `translationsSchema` in `packages/shared/src/schemas/index.ts`
- Language codes defined in `SUPPORTED_LANGUAGES` constant in `packages/shared/src/constants/index.ts`

### Search

Tamil (and other regional language) names are searchable through three mechanisms:

1. **Trigger-based search_text**: The `update_product_search()` PostgreSQL trigger extracts all translation names and concatenates them into `search_text` for trigram matching
2. **Trigger-based search_vector**: Translation names are added to `search_vector` using the `'simple'` dictionary (no stemming, since PostgreSQL has no Tamil text search config)
3. **JSONB keyword search**: The `keywordSearch` function in `apps/api/src/services/search.ts` does substring matching against the translations JSONB column directly

### Mobile App

- **Language detection**: Auto-detects device locale via `expo-localization`. Falls back to English.
- **Manual override**: Settings > Language picker. Stored in AsyncStorage.
- **Display**: When a regional language is active, translated name shows as primary text. English name shows as a smaller subtitle below.
- **Fallback**: If a product/category doesn't have a translation for the active language, the English name is shown as usual.

## Key Files

### Shared Package
| File | What |
|------|------|
| `packages/shared/src/constants/index.ts` | `SUPPORTED_LANGUAGES` constant, `LanguageCode` type |
| `packages/shared/src/schemas/index.ts` | `translationsSchema`, `translationFieldsSchema` — added to product and category create/update schemas |
| `packages/shared/src/types/index.ts` | `translations` field on `CategoryTreeNode` |

### Database
| File | What |
|------|------|
| `apps/api/prisma/schema.prisma` | `translations Json?` on Product and Category models |
| `apps/api/prisma/migrations/20260304002124_add_translations/` | Adds translations column |
| `apps/api/prisma/migrations/20260304002200_update_search_trigger_for_translations/` | Updates search trigger to index translation names |

### API
| File | What |
|------|------|
| `apps/api/src/routes/products/index.ts` | Product create/update passes `translations` to Prisma |
| `apps/api/src/routes/categories/index.ts` | Category create/update passes `translations`, `buildTree` maps translations to response |
| `apps/api/src/routes/home/index.ts` | `buildProductData` includes `translations`, categories query selects `translations` |
| `apps/api/src/services/search.ts` | `keywordSearch` does JSONB substring matching for regional language queries |

### Admin Panel
| File | What |
|------|------|
| `apps/admin/src/pages/products/edit.tsx` | Translations card with Tamil tab (name + description fields) |
| `apps/admin/src/pages/products/create.tsx` | Same translations card |
| `apps/admin/src/pages/products/show.tsx` | Displays translations if present |
| `apps/admin/src/pages/categories/edit.tsx` | Translations card with Tamil name field |
| `apps/admin/src/pages/categories/create.tsx` | Same translations card |

### Mobile App
| File | What |
|------|------|
| `apps/mobile/lib/language-context.tsx` | `LanguageProvider` — device locale detection, AsyncStorage persistence, `getLocalizedName` and `getLocalizedSubtitle` helpers |
| `apps/mobile/lib/types.ts` | `Translations` interface, `translations` field on `Product` and `CategoryTreeNode` |
| `apps/mobile/app/language-settings.tsx` | Language picker screen |
| `apps/mobile/app/_layout.tsx` | Wraps app in `LanguageProvider`, registers `language-settings` screen |
| `apps/mobile/components/ProductGridCard.tsx` | Shows localized name + English subtitle |
| `apps/mobile/components/FeaturedProductCard.tsx` | Shows localized name + English subtitle |
| `apps/mobile/components/ProductCard.tsx` | Shows localized name + English subtitle |
| `apps/mobile/app/product/[id].tsx` | Product detail — localized name in header and body |
| `apps/mobile/app/(tabs)/index.tsx` | Home — category grid uses `getLocalizedName` |
| `apps/mobile/app/(tabs)/categories.tsx` | Category cards, subcategory chips use `getLocalizedName` |
| `apps/mobile/app/category/[id].tsx` | Category sidebar, grandchild pills, header title use `getLocalizedName` |
| `apps/mobile/app/search.tsx` | Search screen — category filter chips and title use `getLocalizedName` |
| `apps/mobile/app/(tabs)/profile.tsx` | Language menu item linking to settings |

### Seed Data
| File | What |
|------|------|
| `apps/api/prisma/seed-translations.ts` | Initial Tamil translations for common products and categories |
| `apps/api/prisma/seed-translations-remaining.ts` | Remaining translations — covers all 324 products and ~190 categories |

## Adding Translations for a New Product

### Via Admin Panel (Single Product)

1. Log in to the admin panel (`http://localhost:7000`)
2. Go to **Products** > find the product > click **Edit**
3. Scroll down to the **Translations** card
4. Click the **Tamil** tab (or any other language tab)
5. Enter the translated **Name** and optionally **Description**
6. Click **Save**
7. The translation is immediately stored and searchable — no extra steps needed

### Via Admin Panel (New Category)

Same flow: **Categories** > Edit > Translations card > enter Tamil name > Save.

### Via API (Programmatic)

```bash
# Update a product with translations
curl -X PUT http://localhost:7001/api/v1/products/<product-id> \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "translations": {
      "ta": { "name": "தமிழ் பெயர்", "description": "விளக்கம்" }
    }
  }'
```

You can include multiple languages in one request:
```json
{
  "translations": {
    "ta": { "name": "Tamil name" },
    "kn": { "name": "Kannada name" },
    "hi": { "name": "Hindi name" }
  }
}
```

### Via Seed Script (Bulk)

For bulk translations, create a seed script in `apps/api/prisma/`:

```typescript
// apps/api/prisma/seed-translations-kannada.ts
import { PrismaClient, Prisma } from "../generated/prisma";
const prisma = new PrismaClient();

const translations: Record<string, { kn: { name: string } }> = {
  "Rice": { kn: { name: "ಅಕ್ಕಿ" } },
  "Milk": { kn: { name: "ಹಾಲು" } },
  // ... more products
};

async function main() {
  for (const [name, trans] of Object.entries(translations)) {
    // Merge with existing translations (don't overwrite Tamil)
    const existing = await prisma.product.findFirst({
      where: { name },
      select: { translations: true },
    });
    const merged = { ...(existing?.translations as any || {}), ...trans };
    await prisma.product.updateMany({
      where: { name },
      data: { translations: merged as Prisma.InputJsonValue },
    });
  }
  // Refresh search index
  const all = await prisma.product.findMany({
    where: { translations: { not: Prisma.DbNull } },
    select: { id: true },
  });
  for (const p of all) {
    await prisma.$executeRawUnsafe(
      `UPDATE products SET name = name WHERE id = '${p.id}'`
    );
  }
}
main().finally(() => prisma.$disconnect());
```

Run with:
```bash
cd apps/api && npx tsx prisma/seed-translations-kannada.ts
```

**Important**: When adding a second language to products that already have Tamil, you must **merge** with existing translations (as shown above) rather than replacing the entire object, or you'll lose the Tamil translations.

## Adding a New Regional Language (e.g., Kannada)

### What's Already Done (No Code Changes Needed)

The infrastructure supports all four languages out of the box:
- Schema accepts `kn`, `te`, `hi` translation keys
- Admin panel already shows tabs for all languages
- Mobile app language picker already lists all four languages
- Search indexing automatically picks up any language in the translations JSON

### Steps to Activate a New Language

1. **Prepare translations** — Get translated names for your products and categories. Options:
   - Manual: Have a native speaker provide translations
   - Google Translate API: Good for grocery terms, ~$20/million characters
   - Claude API: Better nuance, higher cost
   - Freelance translator: Best quality for production

2. **Bulk-seed translations** — Create a seed script (see example above) and run it. Make sure to **merge** with existing translations.

3. **Verify in admin** — Edit a few products, check the new language tab shows the seeded translations.

4. **Verify in mobile** — Switch to the new language in Settings > Language. Product and category names should display in the new language.

5. **Verify search** — Search using regional language text and confirm products appear.

That's it — no database migrations, no API changes, no mobile app changes. The system is fully language-agnostic. Any language code in `SUPPORTED_LANGUAGES` works end-to-end.

### Adding a Language Not in SUPPORTED_LANGUAGES

If you need to add a language beyond the initial four (e.g., Malayalam `ml`):

1. Add the language to `SUPPORTED_LANGUAGES` in `packages/shared/src/constants/index.ts`:
   ```typescript
   export const SUPPORTED_LANGUAGES = {
     ta: "Tamil (தமிழ்)",
     kn: "Kannada (ಕನ್ನಡ)",
     te: "Telugu (తెలుగు)",
     hi: "Hindi (हिन्दी)",
     ml: "Malayalam (മലയാളം)",  // new
   } as const;
   ```

2. Add the label in the mobile language context `LANGUAGE_LABELS` in `apps/mobile/lib/language-context.tsx`

3. Rebuild shared package: `pnpm --filter @martly/shared build`

4. Seed translations and verify as described above.

## Tested

- **API**: Product/category CRUD with translations persists correctly
- **Search**: Tamil queries ("துவரம்", "பால்", "வெங்காயம்") return correct results via trigram, tsvector, and JSONB matching
- **Admin**: Translation forms render, save, and display on product/category pages
- **Mobile**: Language toggle in settings switches display language. Tamil names show as primary with English subtitle. Category sidebar, product cards, product detail, search all display localized names.
