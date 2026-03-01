# Smart Reorder & Predictions

Intelligent replenishment system that analyzes customer purchase frequency to predict when products need reordering, surfaces a one-tap smart cart, and proactively nudges via push notifications.

## How It Works

### Prediction Algorithm

1. Query all `OrderItem` rows for a user+store from DELIVERED/CONFIRMED orders
2. Group by `productId:variantId`, compute per product:
   - `orderCount` — total times purchased
   - `avgQuantity` — average quantity per order
   - `avgIntervalDays` — (lastOrdered - firstOrdered) / (orderCount - 1), only for count >= 2
   - `daysSinceLast` — days since last order
   - `predictedNeed` — daysSinceLast / avgIntervalDays (>1.0 = overdue)
   - Single-purchase products get `predictedNeed = 0.3`
3. Status classification:
   - `overdue` — predictedNeed >= 1.0 (past expected reorder date)
   - `due_soon` — predictedNeed >= 0.7 (approaching reorder date)
   - `not_yet` — below 0.7
4. Results sorted by predictedNeed descending (most urgent first)

### No Schema Changes

Everything is derived from existing `Order` + `OrderItem` data. No new tables needed.

## API

### GET /api/v1/smart-reorder?storeId=xxx

Auth required (CUSTOMER). Returns predicted basket with enriched store product data.

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "store-product-id",
        "productId": "...",
        "product": { "name": "Amul Butter", "imageUrl": "..." },
        "variant": { "name": "500g", "unitType": "g", "unitValue": 500 },
        "pricing": { "effectivePrice": 250, "originalPrice": 280, "discountActive": true },
        "prediction": {
          "orderCount": 5,
          "avgQuantity": 1,
          "avgIntervalDays": 14,
          "daysSinceLast": 18,
          "predictedNeed": 1.29,
          "status": "overdue"
        },
        "suggestedQuantity": 1
      }
    ],
    "summary": {
      "totalProducts": 12,
      "overdueCount": 3,
      "dueSoonCount": 4,
      "estimatedTotal": 1850
    }
  }
}
```

## Mobile Entry Points

1. **SpeedDialFAB** on home screen — "Smart Reorder" button (refresh-circle icon)
2. **Profile page** — Quick Link after "My Tickets"
3. **Push notification tap** — deep links to `/smart-reorder`

## Smart Reorder Screen

- Summary card showing total items, overdue/due soon counts, estimated total
- Product cards with prediction badges (red=overdue, amber=due soon, gray=bought Nx)
- Timing context: "Last ordered X days ago · Usually every Y days"
- Quantity stepper pre-filled with suggested quantity
- Checkbox to include/exclude items from cart
- Select All / Deselect All toggle
- Sticky bottom bar with "Add to Cart" for selected items
- Replace cart confirmation if items from different store

## Replenishment Nudge Scheduler

Background plugin (`reorder-nudge-scheduler.ts`) runs daily (24h interval, 5min startup delay):

1. Finds all users with device tokens
2. For each user, finds their most recent store and runs prediction
3. If any products have `predictedNeed >= 1.0`:
   - Checks if nudge already sent today (prevents spam)
   - Sends push: "Running low? Time to restock! You might need cooking oil, milk..."
   - Notification data includes `{ screen: "smart-reorder" }` for deep linking

## Tested

- `GET /api/v1/smart-reorder?storeId=xxx` — returns predictions with correct sorting
- Error cases: missing storeId (400), invalid storeId (404), no auth (401)
- Empty history returns `{ items: [], summary: { totalProducts: 0, ... } }`
- Deep link from notification → smart-reorder screen
