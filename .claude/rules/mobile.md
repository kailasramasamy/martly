---
globs: apps/mobile/**
---

# Mobile App Conventions (React Native + Expo 54 + Expo Router)

## Navigation

- File-based routing in `app/`, tabs in `app/(tabs)/`
- Every new screen needs `<Stack.Screen name="screen" options={{ headerShown: true, title: "Title" }} />` in `_layout.tsx` — without this, content overlaps the status bar

## API & Auth

- Use `api` helper from `lib/api.ts` (NOT raw fetch) — auto-attaches Bearer token, handles 401 refresh
- `api.get<T>()` returns `ApiResponse<T>` — access via `res.data`
- OTP login: any 10-digit phone, OTP `111111`

## Contexts

- `useAuth()` — `isAuthenticated`, `user`, `login`, `logout`
- `useStore()` — returns `selectedStore` (object, NOT storeId). Derive: `const storeId = selectedStore?.id`
- `useCart()` — `items`, `addItem`, `removeItem`, `storeId`
- `useToast()` — `show(message, type)`
- `useWishlist()` — `items`, `toggle`, `isWished`

## Gotchas

- If fetch has an early return (e.g., `if (!storeId) return`), always set `loading = false` first or the screen hangs on spinner
- Use `FlatList` for lists (NOT `ScrollView` with `.map()`)
- Use `StyleSheet.create`, import tokens from `constants/theme`
- Touch targets minimum 44x44px

## Design Tokens

- Primary: `#0d9488`, Background: `#f8fafc`, Surface: `#ffffff`, Text: `#0f172a`, TextSecondary: `#64748b`, Border: `#e2e8f0`
- Spacing: 4, 8, 12, 16, 20, 24, 32 | Radius: 6, 8, 12, 20 | Font: 11, 13, 15, 17, 20, 24
