# Store Intelligence

Operational intelligence dashboard for store owners. Analyzes order history and stock data to provide demand forecasts, reorder suggestions, anomaly detection, and AI-powered product description generation.

## Endpoints

All endpoints require `authenticate` + role `SUPER_ADMIN`, `ORG_ADMIN`, or `STORE_MANAGER`. Base path: `/api/v1/store-intelligence`.

### GET /demand-forecast

Predicts daily demand per product for a store based on delivered order history.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| storeId | string | required | Store to analyze |
| days | number | 30 | Historical period (1-365) |

Returns products sorted by `daysOfStockLeft` (most urgent first). Products with no demand show `daysOfStockLeft: -1`.

### GET /reorder-suggestions

Products that need restocking within a configurable threshold.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| storeId | string | required | Store to analyze |
| threshold | number | 7 | Days of stock left threshold (1-60) |

Urgency levels: `critical` (<=2 days), `warning` (<=5 days), `info` (<=threshold). Each product includes a `suggestedReorderQty` calculated as 2 weeks of average demand.

### GET /anomalies

Detects unusual patterns in store data.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| storeId | string | required | Store to analyze |
| days | number | 30 | Historical period (7-365) |

Anomaly types:
- **demand_spike** — 7-day avg demand > 2x the period avg (minimum 0.3/day baseline to avoid noise)
- **demand_drop** — 7-day avg demand < 50% of period avg (same minimum baseline)
- **stock_mismatch** — negative stock or reserved stock exceeding total stock
- **dead_stock** — products with available stock but zero orders in the period

### POST /generate-description

AI-powered product image analysis using Claude Vision.

| Body Field | Type | Description |
|-----------|------|-------------|
| imageUrl | string | URL of product image to analyze |

Returns: `name`, `brand`, `description`, `suggestedCategory`, `foodType`, `estimatedWeight`.

## Admin Page

Located at **Operations > Store Intelligence** in the sidebar. Single page with 4 tabs:

1. **Demand Forecast** — Table with stock/demand data, period selector (7/14/30/90d)
2. **Reorder Suggestions** — Summary cards (critical/warning/info counts) + table, threshold selector
3. **Anomalies** — Type filter chips, expandable detail rows, period selector
4. **AI Product Description** — Image URL input or drag-and-drop upload, generates product metadata

## Access Control

- SUPER_ADMIN: full access
- ORG_ADMIN: full access (org-scoped stores)
- STORE_MANAGER: full access (assigned stores only)

## Algorithm Notes

- Demand calculation uses `SUM(quantity) / COUNT(DISTINCT order_days)` for average daily demand
- Only DELIVERED orders are counted
- Reorder quantity suggestion = 14 days of average demand
- Anomaly detection requires minimum 0.3 units/day baseline to flag spikes/drops (filters out noise from rarely-ordered products)

## Tested

```bash
# Demand forecast
GET /api/v1/store-intelligence/demand-forecast?storeId=<id>&days=30

# Reorder suggestions
GET /api/v1/store-intelligence/reorder-suggestions?storeId=<id>&threshold=7

# Anomalies
GET /api/v1/store-intelligence/anomalies?storeId=<id>&days=30

# AI description
POST /api/v1/store-intelligence/generate-description
Body: { "imageUrl": "https://..." }
```

All endpoints return `{ success: true, data: [...], meta: {...} }`.
