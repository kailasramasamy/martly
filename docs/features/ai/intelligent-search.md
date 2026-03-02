# Intelligent Search & Discovery

## Overview

Multi-strategy product search that handles typos, transliterations, Hindi terms, and semantic queries. Falls back gracefully through increasingly powerful search strategies.

## Search Strategies (in order)

| # | Strategy | How | Latency | Example |
|---|----------|-----|---------|---------|
| 1 | **Keyword** | Prisma `contains` (case-insensitive) | <50ms | "milk" → Amul Milk, Mother Dairy |
| 2 | **Trigram Fuzzy** | `pg_trgm` on `search_text` + `search_aliases` | <50ms | "maggii" → Maggi |
| 3 | **Full-Text Search** | `tsvector` with English stemming + ranking | <50ms | "noodle" → Instant Noodles |
| 4 | **Semantic Expansion** | Claude Haiku LLM → keywords → re-query | ~500-800ms | "healthy breakfast" → muesli, oats |

Search returns the first strategy that produces results (≥1 match). LLM is only called when all DB strategies return 0 results.

## Database Infrastructure

### Columns on `products` table

- `search_text TEXT` — Denormalized concat of name + brand + category + parent category + description + tags + ingredients
- `search_vector TSVECTOR` — Weighted FTS vector (A=name, B=brand+category, C=description+tags, D=ingredients)

Both are auto-populated via the `trg_update_product_search` trigger on INSERT/UPDATE.

### Indexes

- `products_search_text_trgm_idx` — GIN trigram index on `search_text`
- `products_search_vector_idx` — GIN index on `search_vector`
- `search_aliases_alias_trgm_idx` — GIN trigram index on `search_aliases.alias`

### Search Aliases

`search_aliases` table stores alternative names for products:
- Brand misspellings: "magee", "maggii", "magi" → Maggi
- Hindi terms: "dahi" → Curd, "jeera" → Cumin Seeds, "haldi" → Turmeric Powder
- Semantic: "healthy breakfast" → Muesli, "party snacks" → Chips/Kurkure

Seed with: `cd apps/api && npx tsx prisma/seed-search-aliases.ts`

## API Changes

### Enhanced: `GET /api/v1/stores/:storeId/products?q=...`

When `q` parameter is provided, uses multi-strategy search instead of simple `contains`.

Response includes additive `searchMeta` field:

```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 3, "page": 1, "pageSize": 20, "totalPages": 1 },
  "searchMeta": {
    "strategy": "fuzzy",
    "correctedQuery": "Maggi 2-Minute Masala Noodles"
  }
}
```

`searchMeta` fields:
- `strategy`: "keyword" | "fuzzy" | "fulltext" | "semantic"
- `correctedQuery`: Product name the fuzzy match resolved to (typo correction)
- `expandedTerms`: Array of terms the LLM expanded the query into (semantic only)

### New: `GET /api/v1/stores/:storeId/products/:productId/substitutes`

Returns up to 5 similar products based on:
- Same category or sibling categories (same parent)
- Same food type (VEG stays VEG)
- Price within ±50% of original
- In stock (`stock > 0`)

Response shape: `ApiResponse<StoreProduct[]>`

## Mobile Changes

### Search Screen (`apps/mobile/app/search.tsx`)

Shows a teal banner between filter chips and results when search strategy is not "keyword":
- Fuzzy: "Showing results for **Maggi 2-Minute Masala Noodles**"
- Semantic: "Showing results for **muesli, oats, granola**"

### Product Detail (`apps/mobile/app/product/[id].tsx`)

When any variant is out of stock, shows a "Similar Products" horizontal carousel fetched from the substitutes endpoint.

## Key Files

| File | Description |
|------|-------------|
| `apps/api/prisma/migrations/20260302000000_intelligent_search/migration.sql` | pg_trgm, search columns, trigger |
| `apps/api/src/services/search.ts` | Multi-strategy search service |
| `apps/api/src/routes/stores/index.ts` | Enhanced products endpoint + substitutes |
| `apps/api/prisma/seed-search-aliases.ts` | Alias seeder |
| `apps/mobile/app/search.tsx` | Search meta banner |
| `apps/mobile/app/product/[id].tsx` | Substitute suggestions |

## Testing

```bash
# Login
TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@martly.dev","password":"customer123"}' \
  | jq -r '.data.accessToken')

STORE_ID="375d5737-069b-42f0-9791-1cc8390c0993"

# Keyword
curl -s "http://localhost:7001/api/v1/stores/$STORE_ID/products?q=milk" \
  -H "Authorization: Bearer $TOKEN" | jq '.searchMeta'

# Fuzzy (typo)
curl -s "http://localhost:7001/api/v1/stores/$STORE_ID/products?q=maggii" \
  -H "Authorization: Bearer $TOKEN" | jq '.searchMeta'

# Hindi term
curl -s "http://localhost:7001/api/v1/stores/$STORE_ID/products?q=dahi" \
  -H "Authorization: Bearer $TOKEN" | jq '.searchMeta'

# Substitutes
curl -s "http://localhost:7001/api/v1/stores/$STORE_ID/products/PRODUCT_ID/substitutes" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[].product.name'
```

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for semantic expansion (Step 4). If not set, semantic fallback is silently skipped.

## What Needs Manual Verification

- Mobile: search for typo queries and verify the teal banner appears
- Mobile: navigate to an out-of-stock product variant and verify "Similar Products" carousel
- Semantic expansion: test with queries like "something for breakfast" (requires ANTHROPIC_API_KEY)
