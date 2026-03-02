# Frequently Bought Together

Data-driven product recommendations based on co-purchase patterns from delivered orders.

## How It Works

1. **Co-purchase analysis**: Raw SQL self-join on `order_items` finds products that appear together in DELIVERED orders from the last 90 days for the same store
2. **Fallback**: If fewer than 3 co-purchase results, supplements with best-selling products from the store
3. **Post-processing**: Deduplicates by productId, applies effective pricing, formats variants, fetches review aggregates

## API

### `GET /api/v1/stores/:id/frequently-bought-together`

**Auth**: Optional (public endpoint, same as store products)

**Query params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `productIds` | string | Yes | Comma-separated product IDs |
| `exclude` | string | No | Comma-separated store product IDs to exclude |
| `limit` | number | No | Max results (default 8, max 12) |

**Response**: `ApiResponse<StoreProduct[]>` with pricing, variant, and review data.

**Use cases**:
- **Product detail**: Pass single productId to get co-purchase suggestions
- **Cart**: Pass all cart productIds, exclude cart storeProductIds

## Mobile Screens

### Product Detail (`app/product/[id].tsx`)
- "Frequently Bought Together" horizontal card list
- Placed above "Similar Products" (substitutes) section
- Uses `FeaturedProductCard` component

### Cart (`app/(tabs)/cart.tsx`)
- "Customers Also Bought" horizontal card list
- Placed before Bill Details in the list footer
- Add-to-cart buttons work directly from the suggestions
- Re-fetches when cart items change

## Testing

```bash
STORE=375d5737-069b-42f0-9791-1cc8390c0993

# Single product (product detail)
curl -s "http://localhost:7001/api/v1/stores/$STORE/frequently-bought-together?productIds=PRODUCT_ID" | python3 -m json.tool

# Multiple products (cart)
curl -s "http://localhost:7001/api/v1/stores/$STORE/frequently-bought-together?productIds=ID1,ID2&limit=6" | python3 -m json.tool
```

## Notes

- No schema changes required — all data derived from existing `order_items`
- No admin panel changes needed — purely data-driven, zero configuration
- Falls back to best-sellers when insufficient co-purchase data (new stores, new products)
