# Customer Wallet — Refund on Cancel + Use at Checkout

## How It Works

### Wallet Balance
- Every customer has a `walletBalance` field on their user record (starts at 0)
- Balance is stored as `Decimal(10,2)` for precision
- `WalletTransaction` table provides an immutable audit log of all credits/debits

### Refund on Cancel
When a customer or admin cancels an order:

1. **ONLINE + PAID order**: Full `totalAmount` is refunded to wallet, `paymentStatus` set to `REFUNDED`
2. **COD order that used wallet**: Only the `walletAmountUsed` portion is refunded
3. **COD order without wallet**: No refund (nothing was charged)

### Wallet at Checkout
When creating an order with `useWallet: true` (default):

1. Server checks user's `walletBalance`
2. `walletDeduction = min(walletBalance, totalAmount)`
3. If wallet fully covers the order: `paymentStatus = PAID`, `status = CONFIRMED`, no Razorpay needed
4. If partial: `walletAmountUsed` stored on order, Razorpay charges only the remaining amount
5. `useWallet: false` bypasses wallet entirely

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/wallet` | GET | Returns wallet balance + last 50 transactions |
| `/api/v1/orders` | POST | Now accepts `useWallet` field, returns `walletFullyCovered` + `razorpayAmount` |
| `/api/v1/orders/:id/cancel` | POST | Refunds to wallet if applicable |
| `/api/v1/orders/:id/status` | PATCH | Admin cancel also refunds to wallet |
| `/api/v1/orders/:id/payment` | POST | Charges `totalAmount - walletAmountUsed` |

### Mobile Screens
- **Checkout**: Wallet section with toggle, bill shows wallet deduction, payment method hidden when fully covered
- **Order Detail**: Shows "Wallet used" in bill summary, REFUNDED payment status as blue badge
- **Profile**: "Martly Wallet" menu item with inline balance
- **Wallet Screen** (`/wallet`): Balance card + transaction history with tap-to-view-order

## What Was Tested (API)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Cancel PAID ONLINE order | Wallet credited with `totalAmount`, paymentStatus = REFUNDED |
| 2 | GET /wallet | Balance = 290, 1 CREDIT transaction |
| 3 | Create order with wallet (full coverage) | `walletFullyCovered: true`, `paymentStatus: PAID`, `status: CONFIRMED` |
| 4 | Create order with `useWallet: false` | Wallet untouched |
| 5 | Cancel COD order that used wallet | Only `walletAmountUsed` refunded, paymentStatus stays PENDING |
| 6 | Admin cancel PAID order | Wallet refunded to customer |

## What Needs Manual Verification

- [ ] Mobile: Checkout wallet toggle appears when balance > 0
- [ ] Mobile: Payment method section hidden when wallet covers full amount
- [ ] Mobile: Order detail shows "Wallet used" line and "Refunded to Wallet" badge
- [ ] Mobile: Profile shows wallet menu item with balance
- [ ] Mobile: Wallet screen loads and displays transactions
- [ ] Mobile: Tapping transaction with orderId navigates to order detail
