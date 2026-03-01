# AI Customer Support

## Overview

AI-powered customer support chat that helps customers with order issues, delivery questions, payments, and escalates to human agents via ticket creation. Reuses the Claude tool-use pattern from AI ordering with support-specific tools.

## How It Works

### Customer Flow

1. **Entry points:**
   - Home screen FAB (speed-dial) → "Help & Support"
   - Order detail → "Get Help with this Order" button
2. Customer opens support chat, sees welcome message + suggestion chips
3. AI assistant uses tools to look up real order/store data
4. If the AI can't resolve the issue or customer asks for a human, a `SupportTicket` is created
5. Green "Ticket Created" card shown in chat with ticket ID

### Admin Flow

1. Admin panel → "Support Tickets" in sidebar
2. List page shows all tickets with status/priority tags, customer info, linked order
3. Click a ticket to see the full conversation timeline (customer/AI/admin messages)
4. Admin can reply (appended to messages JSON) and update status (RESOLVED/CLOSED)

## Architecture

### Database

```
SupportTicket
├── id, userId, storeId?, orderId?, organizationId?
├── subject, status (OPEN/RESOLVED/CLOSED), priority (LOW/MEDIUM/HIGH)
├── messages: JSON array [{role, content, timestamp}]
└── createdAt, updatedAt
```

Messages JSON stores the full conversation history — user messages, AI responses, and admin replies in a single field.

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/support/chat` | Customer JWT | AI support chat |
| GET | `/api/v1/support/tickets` | Admin JWT | List tickets (paginated, org-scoped) |
| GET | `/api/v1/support/tickets/:id` | Admin JWT | Ticket detail |
| PATCH | `/api/v1/support/tickets/:id` | Admin JWT | Update status + reply |

### AI Tools

| Tool | Description |
|------|-------------|
| `get_order_details` | Look up a specific order by ID (verifies userId match) |
| `get_my_orders` | List customer's last 10 orders |
| `get_store_info` | Store name, address, phone |
| `create_ticket` | Escalate to human — creates SupportTicket with conversation history |

### Files

| File | Purpose |
|------|---------|
| `apps/api/prisma/schema.prisma` | SupportTicket model + enums |
| `packages/shared/src/constants/index.ts` | TicketStatus, TicketPriority |
| `apps/api/src/routes/support/index.ts` | Chat + admin ticket routes |
| `apps/api/src/app.ts` | Route registration |
| `apps/mobile/app/support-chat.tsx` | Support chat screen |
| `apps/mobile/app/_layout.tsx` | Screen registration |
| `apps/mobile/app/(tabs)/index.tsx` | Speed-dial FAB |
| `apps/mobile/app/order/[id].tsx` | "Get Help" button |
| `apps/admin/src/pages/support-tickets/list.tsx` | Ticket list page |
| `apps/admin/src/pages/support-tickets/show.tsx` | Ticket detail + reply page |
| `apps/admin/src/App.tsx` | Resource + route registration |
| `apps/admin/src/providers/access-control.ts` | Ticket permissions |
| `apps/admin/src/constants/tag-colors.ts` | Status/priority tag colors |

## Verification Checklist

### Mobile — Speed-Dial FAB

- [ ] Open home screen with a store selected
- [ ] Tap FAB (sparkles icon) → verify it expands into 2 mini-FABs with labels
- [ ] Verify semi-transparent overlay appears behind mini-FABs
- [ ] Tap "AI Order" → verify AI ordering screen opens
- [ ] Go back, re-open FAB, tap "Help & Support" → verify support chat opens
- [ ] Tap overlay or X button → verify FAB collapses back to single button

### Mobile — Support Chat

- [ ] Open support chat → verify header shows headset icon, "Martly Support", store name
- [ ] Verify welcome message: "Hi! I'm here to help with any issues..."
- [ ] Verify suggestion chips: "Where's my order?", "Payment issue", "Talk to a human"
- [ ] Tap "Where's my order?" → verify AI looks up recent orders and lists them
- [ ] Type "Tell me about order #[id]" → verify AI fetches specific order details
- [ ] Ask "What's your store address?" → verify AI returns store info
- [ ] Say "I want to talk to a human" → verify:
  - AI creates a ticket
  - Green "Ticket Created" card appears with ticket ID
  - Response includes `ticketCreated: true`
- [ ] Test error state: disconnect network, send message → verify error bubble with retry button

### Mobile — Order-Specific Support

- [ ] Open any order detail page
- [ ] Verify "Get Help with this Order" button visible (teal outline, headset icon)
- [ ] Tap it → verify support chat opens
- [ ] Verify info banner: "Asking about Order #XXXXXXXX..."
- [ ] Verify AI automatically looks up that order in its first response

### Admin — Ticket List

- [ ] Log in as admin → verify "Support Tickets" appears in sidebar
- [ ] Open Support Tickets → verify table shows seeded tickets
- [ ] Verify columns: Subject, Customer, Store, Status, Priority, Order, Created
- [ ] Verify status tags: OPEN=orange, RESOLVED=green, CLOSED=default
- [ ] Verify priority tags: LOW=default, MEDIUM=blue, HIGH=red
- [ ] Test search: type a subject keyword → verify filtering works
- [ ] Test status filter: select "Open" → verify only open tickets shown
- [ ] Click eye icon on a ticket → verify navigates to detail page

### Admin — Ticket Detail

- [ ] Verify ticket info card: subject, status, customer, priority, store, created date
- [ ] Verify linked order info shows when ticket has an orderId
- [ ] Verify conversation timeline with colored messages:
  - Blue background = Customer messages (user icon)
  - Teal background = AI Support messages (robot icon)
  - Yellow background = Admin messages (headset icon)
- [ ] Type a reply in the text area
- [ ] Select "Resolved" from status dropdown
- [ ] Click "Reply & Update" → verify:
  - Success message appears
  - New admin message appears in timeline (yellow)
  - Status tag updates to green "Resolved"
- [ ] Verify "Admin Reply" section hidden for CLOSED tickets

### Admin — Access Control

- [ ] Log in as SUPER_ADMIN → verify full access (list + show + update)
- [ ] Log in as ORG_ADMIN → verify full access, scoped to org's stores
- [ ] Log in as STORE_MANAGER → verify read-only (list + show, no reply form)

### API — curl tests

```bash
# Get customer token
CTOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@martly.dev","password":"customer123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Test support chat
curl -s http://localhost:7001/api/v1/support/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CTOKEN" \
  -d '{"storeId":"375d5737-069b-42f0-9791-1cc8390c0993","messages":[{"role":"user","content":"Where is my order?"}]}' \
  | python3 -m json.tool
# Expected: success=true, message with order info, ticketCreated=false

# Test ticket escalation
curl -s http://localhost:7001/api/v1/support/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CTOKEN" \
  -d '{"storeId":"375d5737-069b-42f0-9791-1cc8390c0993","messages":[{"role":"user","content":"I want to talk to a human"}]}' \
  | python3 -m json.tool
# Expected: success=true, ticketCreated=true, ticketId present

# Get admin token
ATOKEN=$(curl -s http://localhost:7001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@martly.dev","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# List tickets
curl -s "http://localhost:7001/api/v1/support/tickets?page=1&pageSize=10" \
  -H "Authorization: Bearer $ATOKEN" \
  | python3 -m json.tool
# Expected: success=true, data array with tickets, meta with total

# Admin reply + status update (replace TICKET_ID)
curl -s -X PATCH "http://localhost:7001/api/v1/support/tickets/TICKET_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ATOKEN" \
  -d '{"reply":"We are looking into this.","status":"RESOLVED"}' \
  | python3 -m json.tool
# Expected: success=true, status=RESOLVED, messages array includes admin reply
```

## What Needs Manual Verification

- [ ] Mobile app renders support chat correctly on device/simulator
- [ ] Speed-dial animation is smooth (spring physics)
- [ ] Keyboard avoidance works properly in support chat
- [ ] Chat scrolls correctly with inverted FlatList
- [ ] Order context (orderId param) flows through correctly from order detail
