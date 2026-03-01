# Customer Onboarding Flow

## Overview

Mandatory phone OTP authentication on first app open, with ProfileGate for address collection at checkout. No guest browsing — follows the Zepto/Blinkit/BigBasket industry pattern.

## Flow

### New Customer (first open)
1. **App opens** → Auth check → Not logged in → Redirect to login screen
2. **Login screen** → Enter phone number → Receive OTP
3. **Verify OTP** → New user detected → Collect name → Done
4. **Home screen** → Store auto-selected via GPS → Browse products
5. **Add to cart** → Proceed to checkout
6. **Checkout** → No saved addresses → "Add your delivery address" prompt → **ProfileGate** bottom sheet
7. **ProfileGate** → AddressAutocomplete (Google Places search + GPS "Use current location") → Save address
8. **Continue checkout** → Address saved → Delivery lookup runs (distance-based fee, serviceability) → Place order

### Returning Customer
1. **App opens** → Token in SecureStore → Auth verified → Straight to tabs
2. **Checkout** → Saved address pre-selected → Delivery lookup auto-runs → Place order

### Key Components

| Component | Purpose |
|-----------|---------|
| `_layout.tsx` (root) | Auth redirect — forces login if not authenticated |
| `/(auth)/login.tsx` | Phone → OTP → Name (new users) full-screen flow |
| `ProfileGate.tsx` | Bottom sheet for first address collection at checkout |
| `AddressAutocomplete.tsx` | Google Places search + GPS location for accurate lat/lng |

## What Changed

### Root Layout (`apps/mobile/app/_layout.tsx`)
- Split into `RootLayout` (providers) + `RootLayoutNav` (auth redirect logic)
- Shows loading spinner while checking auth state
- Redirects to `/(auth)/login` if not authenticated
- Redirects to `/(tabs)` if authenticated but on auth screen

### Home Screen (`apps/mobile/app/(tabs)/index.tsx`)
- Removed guest "Sign In" card — always shows authenticated greeting

### Profile Screen (`apps/mobile/app/(tabs)/profile.tsx`)
- Removed unauthenticated "Sign In to Martly" fallback
- Wired AddressAutocomplete into address modal (lat/lng capture)

### Orders Screen (`apps/mobile/app/(tabs)/orders.tsx`)
- Removed guest checks — always fetches orders (auth guaranteed)
- Removed "Sign in to see your orders" empty state

### Checkout (`apps/mobile/app/checkout.tsx`)
- Replaced `AuthGate` with `ProfileGate`
- Added "No saved addresses" prompt card that opens ProfileGate
- Added "Deliver to a different address" button for existing users (opens ProfileGate)
- All new addresses go through ProfileGate → saved to profile with lat/lng → auto-selected
- Removed inline new address TextInput — addresses always saved via ProfileGate for reusability

### New: ProfileGate (`apps/mobile/components/ProfileGate.tsx`)
- Bottom sheet modal with address type picker (Home/Work/Other)
- AddressAutocomplete for Google Places search + GPS
- Saves address with lat/lng/pincode to API
- Auto-marks first address as default

## Manual Verification

1. **Fresh install** — Clear SecureStore, open app → should redirect to login
2. **Login flow** — Enter phone → OTP (111111 for dev) → Name for new user → Lands on home
3. **Checkout with no address** — Add items, go to checkout → "Add your delivery address" card → Tap → ProfileGate opens
4. **ProfileGate** — Search address or use GPS → Save → Returns to checkout with address pre-selected
5. **Delivery lookup** — After address saved, delivery lookup should fire (check fee/serviceability)
6. **Returning user** — Kill app, reopen → Should go straight to home (no login screen)
