# Customer Insights

AI-powered customer intelligence for store owners. Three capabilities: natural language analytics Q&A, churn risk prediction, and review sentiment summarization.

## Architecture

- **API**: `apps/api/src/routes/customer-insights/index.ts` — 3 endpoints
- **Admin**: `apps/admin/src/pages/customer-insights/index.tsx` — 3-tab page under Operations
- **AI**: Claude Haiku for ask + review summary endpoints
- **No schema changes** — all computed from existing data

## Endpoints

All require `authenticate` + `requireRole("SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER")`.
Store access validated via `verifyStoreOrgAccess()`.

### POST `/api/v1/customer-insights/ask`

Natural language analytics Q&A. Gathers 30-day store metrics and sends to Claude Haiku with the user's question.

**Request**: `{ storeId: string, question: string }`

**Response**: `{ answer: string, context: { revenue, revenueChange, orderCount, orderChange, customerCount, customerChange, aov, topProducts } }`

Rate limited: 30 requests/min per user.

### GET `/api/v1/customer-insights/churn-risk?storeId=xxx`

Pure SQL computation — no AI. Groups customers by order history and classifies by days since last order.

| Risk Level | Days Since Last Order | Suggested Action |
|-----------|----------------------|-----------------|
| active | < 14 | Keep engaging with personalized recommendations |
| at_risk | 14-30 | Send personalized offer with favorite products |
| churning | 30-60 | Send win-back coupon (10-15% off) with limited expiry |
| churned | 60+ | Send "We miss you" message with aggressive discount |

**Response**: `{ summary: { active, atRisk, churning, churned, totalCustomers }, customers: [...] }`

### GET `/api/v1/customer-insights/review-summary?storeId=xxx&days=90`

Fetches approved product reviews + store ratings, sends to Claude Haiku for sentiment analysis.

**Response**: `{ overallSentiment, summary, positives[], negatives[], patterns[], recommendations[], meta }`

## Admin Page

Located at `/customer-insights` under Operations sidebar group. Three tabs:

1. **Ask Your Store** — Suggested question tags + text input. Shows AI answer + context stats.
2. **Churn Risk** — Summary cards + filterable customer table with risk levels.
3. **Review Insights** — Period selector + "Generate Summary" button. Sentiment tag + insight cards.

## Access Control

- SUPER_ADMIN: full access
- ORG_ADMIN: full access (org-scoped)
- STORE_MANAGER: full access (store-scoped)

## Tested

```bash
# Ask
curl -s -X POST "http://localhost:7001/api/v1/customer-insights/ask" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"storeId":"STORE_ID","question":"How did I do last week?"}'

# Churn risk
curl -s "http://localhost:7001/api/v1/customer-insights/churn-risk?storeId=STORE_ID" \
  -H "Authorization: Bearer $TOKEN"

# Review summary
curl -s "http://localhost:7001/api/v1/customer-insights/review-summary?storeId=STORE_ID&days=90" \
  -H "Authorization: Bearer $TOKEN"
```

All 3 endpoints verified working with SUPER_ADMIN token and Bigmart store.
