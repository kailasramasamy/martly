# Return/Refund Requests

## Overview

Customers can submit return/refund requests for delivered orders within a 48-hour window. Admin reviews and approves (wallet refund) or rejects with a reason. No physical return — this is a refund evidence flow for grocery items.

## Flow

1. **Customer** opens a delivered order (within 48h) and taps "Request Return/Refund"
2. Selects items with quantities, picks a reason, adds optional description and photos
3. Submits the request — status becomes **PENDING**
4. **Admin** sees the request in the Returns list, views details including photos
5. Admin either:
   - **Approves**: Sets refund amount (defaults to full, can be partial), wallet is credited immediately
   - **Rejects**: Provides a required admin note explaining why

## Key Design Decisions

- **One request per order** (`orderId` is unique) — no multi-round back-and-forth
- **No physical return** — grocery items aren't returned
- **Wallet-only refund** — reuses existing cancellation refund pattern
- **Admin sets final amount** — `approvedAmount` can be partial or full
- **48-hour window** — configurable via `RETURN_WINDOW_HOURS` constant (default: 48)
- **Images as String[]** — same as Product.images pattern

## Database

### ReturnRequest
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| orderId | UUID | Unique — one request per order |
| userId | UUID | Customer who filed |
| organizationId | UUID | Org scope |
| storeId | UUID | Store scope |
| status | PENDING/APPROVED/REJECTED | Current state |
| reason | String | Selected from predefined list |
| description | String? | Optional details |
| images | String[] | Uploaded photo URLs |
| requestedAmount | Decimal | Auto-calculated from selected items |
| approvedAmount | Decimal? | Set by admin on approval |
| adminNote | String? | Required for rejection, optional for approval |
| resolvedAt | DateTime? | When admin resolved |
| resolvedBy | UUID? | Admin who resolved |

### ReturnRequestItem
| Field | Type | Description |
|-------|------|-------------|
| returnRequestId | UUID | FK to ReturnRequest |
| orderItemId | UUID | FK to OrderItem |
| quantity | Int | Items being returned |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/return-requests` | CUSTOMER | Create request |
| GET | `/api/v1/return-requests/my-requests` | CUSTOMER | List own requests (paginated) |
| GET | `/api/v1/return-requests/my-requests/:orderId` | CUSTOMER | Check request for specific order |
| GET | `/api/v1/return-requests` | ORG_ADMIN+ | List all (org-scoped, filterable) |
| GET | `/api/v1/return-requests/:id` | ORG_ADMIN+ | Detail with items, user, order |
| PATCH | `/api/v1/return-requests/:id/resolve` | ORG_ADMIN+ | Approve or reject |

## Validations

- Order must be DELIVERED
- Order must belong to the requesting customer
- Must be within 48-hour return window
- No existing return request for the order
- Items must belong to the order
- Quantities must not exceed order quantities
- Admin note is required when rejecting

## Admin Panel

- **Returns** page in sidebar (RollbackOutlined icon)
- List page with filters (status, search by order/customer)
- Show page with approve/reject modals, photo viewer, items table
- Order show page displays return request status when one exists

## Mobile App

- Order detail shows "Request Return/Refund" button for DELIVERED orders within 48h
- Return request form: item selection with qty, reason picker, description, photo upload
- After submission: order detail shows return status card with progress

## Manual Verification

### Setup

You need a freshly delivered order to test with. Either place a new order via mobile and have admin mark it DELIVERED, or use an existing one that was delivered within the last 48 hours.

**Accounts:**
- Customer: `customer@martly.dev` / `customer123`
- Admin: `admin@martly.dev` / `admin123` (or `owner@innovative.dev` / `owner123`)

---

### 1. Mobile — Submit a return request

- [x] Log in as customer on mobile app
- [x] Go to Orders tab, open a DELIVERED order that was delivered within the last 48h
- [x] Scroll down past ratings — you should see a "Request Return/Refund" button
- [x] Tap it — "Request Return" screen opens
- [x] All order items are listed with checkboxes checked and quantities matching the order
- [x] Uncheck one item — its quantity controls disappear, refund amount decreases
- [x] Re-check it, then use the minus button — quantity goes down, refund amount updates
- [x] Pick a reason (e.g. "Damaged/broken item") — radio button highlights teal
- [x] Type something in the description field
- [x] Tap the camera icon, pick 1-2 photos from gallery
- [x] Verify photos appear as thumbnails, tap the X on one to remove it
- [x] Tap "Submit Return Request"
- [x] Loading state shows ("Uploading photos..." then "Submitting...")
- [x] Success toast appears, you're navigated back to the order detail
- [x] The "Request Return/Refund" button is now replaced with a status card showing "Pending Review"
- [x] Card shows the reason and requested amount

### 2. Mobile — Duplicate and edge cases

- [x] On the same order, confirm the button is gone — only the status card is visible
- [x] Open a different DELIVERED order that is older than 48 hours — no return button visible
- [x] Open a non-delivered order (CONFIRMED, PREPARING, etc.) — no return button visible

### 3. Admin — View and approve

- [x] Log in to admin panel (`localhost:7000`) as `admin@martly.dev`
- [x] "Returns" appears in the sidebar
- [x] Click it — list page shows the return request you just submitted
- [x] Verify columns: Order ID, Customer name, Store, Reason, Amount (₹), Status (orange "Pending"), Date
- [x] Use the status dropdown to filter by "Pending" — your request shows
- [x] Filter by "Approved" — list is empty (or shows previously approved ones)
- [x] Clear filter, type the customer name in search — request appears
- [x] Click the eye icon to open the detail page
- [x] Verify: reason, description, requested amount, customer name/email, store name
- [x] If you uploaded photos, they show in a Photos section — click one to zoom
- [x] Items table shows product name, variant, qty returned, unit price, line total
- [x] "Approve" and "Reject" buttons visible at the top
- [x] Click "Approve" — modal opens with refund amount pre-filled
- [x] Change the amount to something lower (partial refund), add an optional note
- [x] Click "Approve & Refund" — success message, page refreshes
- [x] Status is now "Approved" in green, approved amount and admin note visible
- [x] Approve/Reject buttons are gone

### 4. Admin — Verify wallet refund

- [x] Go to the order detail page for the same order (Orders > click the order)
- [x] "Return Request" row in Order Summary shows "Approved" tag + "View Details" link
- [x] Click "View Details" — navigates to the return request show page

### 5. Mobile — Verify approval status

- [x] Back on mobile, open the same order
- [x] Status card now shows "Approved" in green
- [x] Approved amount is displayed
- [x] If you added an admin note, it shows
- [x] Go to Wallet screen — latest transaction shows "Refund for return request on order #XXXXXXXX" with the correct amount

### 6. Admin — Reject a different request

- [x] On mobile, submit a return request on a different recently delivered order
- [x] In admin panel, go to Returns, open the new pending request
- [x] Click "Reject" — modal opens with a note textarea
- [x] Try clicking "Reject" button in the modal with empty note — button is disabled
- [x] Type a reason (e.g. "Items verified correct in delivery photo")
- [x] Click "Reject" — success message, page refreshes
- [x] Status is now "Rejected" in red, admin note visible

### 7. Mobile — Verify rejection status

- [x] Open the rejected order on mobile
- [x] Status card shows "Rejected" in red with the admin note
- [x] Wallet screen — no new refund transaction for this order

### 8. Admin — Access control

- [x] Log in as `manager@bigmart.dev` / `manager123` (STORE_MANAGER)
- [x] "Returns" is visible in sidebar
- [x] List page loads — only shows requests for Bigmart store
- [x] Can open a request detail page
- [x] Approve/Reject buttons should NOT appear (store manager is read-only)
