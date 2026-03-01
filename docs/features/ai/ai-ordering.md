# AI-Powered Ordering (Phase 1 — Text Commands)

## Overview

Conversational AI grocery assistant that lets customers order via natural language text. Users type things like "add 2 packets of Maggi" or "I need milk and bread" and the AI searches the store catalog, presents product options, and helps build the cart.

Uses **Anthropic Claude Haiku** via tool use for real-time product search against the store's inventory. Stateless architecture — client sends message history each request.

## How It Works

```
User types message (e.g., "I need milk")
    ↓
Mobile sends POST /api/v1/ai/chat { storeId, messages[], cart[] }
    ↓
API builds system prompt (store name + current cart)
    ↓
Calls Claude Haiku with 3 tools: search_products, get_categories, get_product_details
    ↓
Claude calls tools → API executes Prisma queries → feeds results back (max 5 iterations)
    ↓
Claude returns JSON: { message, products[], actions[] }
    ↓
Mobile renders chat bubble + horizontal product cards + ADD buttons
    ↓
User taps ADD → client-side useCart().addItem()
```

**Key design decisions:**
- **Stateless** — client sends last 20 messages each request, no server-side session
- **Cart stays client-side** — AI suggests items, user adds via existing cart context
- **JSON response format** — structured `{ message, products, actions }` for consistent rendering
- **No schema changes** — uses existing product/store data, no new DB tables

## API Endpoint

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/v1/ai/chat` | Customer (JWT) | Send message, get AI response with products |

### Request Body

```json
{
  "storeId": "store-uuid",
  "messages": [
    { "role": "user", "content": "I need milk" },
    { "role": "assistant", "content": "Found milk options!" },
    { "role": "user", "content": "also bread" }
  ],
  "cart": [
    { "productName": "Amul Gold Milk", "variantName": "1 L", "quantity": 1, "price": 66 }
  ]
}
```

### Response

```json
{
  "success": true,
  "data": {
    "message": "Here are some bread options!",
    "products": [
      {
        "storeProductId": "sp-uuid",
        "productId": "p-uuid",
        "name": "Britannia Brown Bread",
        "brand": "Britannia",
        "variant": "400 g",
        "price": 45,
        "originalPrice": null,
        "inStock": true,
        "imageUrl": "https://..."
      }
    ],
    "actions": []
  }
}
```

### Rate Limiting

30 requests per minute per user (in-memory). Returns `429 Too Many Requests` when exceeded.

## Claude Tools

| Tool | Input | What it does |
|------|-------|-------------|
| `search_products` | `query`, optional `categoryId` | Searches `storeProduct` by product name, returns up to 10 results with pricing |
| `get_categories` | (none) | Returns top-level categories (id + name) |
| `get_product_details` | `productId` | Returns product with all store variants, pricing, stock |

Tools use the same pricing logic as the store products endpoint (`calculateEffectivePrice` + `formatVariantUnit`).

## Mobile App

### Entry Point
- **FAB** (floating action button) on home screen — bottom-right, sparkle icon, primary green
- Only visible when a store is selected
- Navigates to `/ai-order`

### Chat Screen (`apps/mobile/app/ai-order.tsx`)
- **Custom header**: back button, "Martly AI" with sparkle icon, store name, cart badge
- **Welcome message**: static greeting with store name and usage examples
- **Message types**: user (green, right), assistant (white, left), loading (typing dots), error (with retry)
- **Product cards**: horizontal scroll below AI messages — image, name, brand, variant, price, ADD/qty controls
- **Quick suggestions**: "Show categories", "Today's deals", "What's popular?" chips shown before first message
- **Cart integration**: uses existing `useCart()`, handles different-store confirmation via `ConfirmSheet`
- **Keyboard**: `KeyboardAvoidingView` pushes input bar above keyboard

## Files

| File | Purpose |
|------|---------|
| `apps/api/src/routes/ai/index.ts` | AI chat endpoint, Claude tool use, rate limiting |
| `apps/mobile/app/ai-order.tsx` | Chat screen UI |
| `apps/mobile/app/_layout.tsx` | Screen registration (`headerShown: false`) |
| `apps/mobile/app/(tabs)/index.tsx` | FAB entry point |

## Testing

### Prerequisites
- API server running (`pnpm --filter @martly/api dev`)
- Valid `ANTHROPIC_API_KEY` in `apps/api/.env`
- Seeded store with products (Bigmart: `375d5737-069b-42f0-9791-1cc8390c0993`)

### Get Auth Token

```bash
TOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"customer@martly.dev","password":"customer123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
```

### Test 1: Basic Product Search

```bash
curl -s http://localhost:7001/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "storeId": "375d5737-069b-42f0-9791-1cc8390c0993",
    "messages": [{"role": "user", "content": "I need milk"}],
    "cart": []
  }' | python3 -m json.tool
```

**Expected**: `products` array with milk variants (Amul, Mother Dairy, Nestle, Nandini), each with storeProductId, price, imageUrl.

### Test 2: Multi-Turn with Cart Context

```bash
cat > /tmp/ai-test.json << 'EOF'
{
  "storeId": "375d5737-069b-42f0-9791-1cc8390c0993",
  "messages": [
    {"role": "user", "content": "I need milk"},
    {"role": "assistant", "content": "Found milk options for you!"},
    {"role": "user", "content": "also bread"}
  ],
  "cart": [{"productName": "Amul Gold Full Cream Milk", "variantName": "1 L", "quantity": 1, "price": 66}]
}
EOF

curl -s http://localhost:7001/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @/tmp/ai-test.json | python3 -m json.tool
```

**Expected**: `products` array with bread options. AI is aware of cart (milk already added).

### Test 3: Browse Categories

```bash
curl -s http://localhost:7001/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "storeId": "375d5737-069b-42f0-9791-1cc8390c0993",
    "messages": [{"role": "user", "content": "Show categories"}],
    "cart": []
  }' | python3 -m json.tool
```

**Expected**: `message` lists available categories (Grocery, Food, Personal Care, etc.), `products` is empty.

### Test 4: Error Cases

```bash
# Unauthenticated — should return 401
curl -s http://localhost:7001/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"storeId":"x","messages":[{"role":"user","content":"hi"}],"cart":[]}' \
  | python3 -m json.tool

# Invalid store — should return 404
curl -s http://localhost:7001/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"storeId":"nonexistent","messages":[{"role":"user","content":"hi"}],"cart":[]}' \
  | python3 -m json.tool
```

### Test 5: Mobile App

1. Open the app, ensure a store is selected
2. Tap the sparkle FAB on home screen → opens AI chat
3. Type "I need milk" → see product cards with ADD buttons
4. Tap ADD on a product → verify it appears in cart
5. Type "also bread" → see bread products (multi-turn works)
6. Type "show my cart" → AI summarizes cart contents
7. Tap cart icon in header → navigates to checkout with items

### What Needs Manual Verification

- Product images render correctly in chat cards
- Discount badge shows on discounted products
- Quantity +/- controls work after adding an item
- Quick suggestion chips disappear after first message
- Keyboard pushes input bar up correctly on iOS and Android
- Replace cart confirmation shows when adding from a different store
