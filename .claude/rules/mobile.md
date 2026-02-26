---
globs: apps/mobile/**
---

# Mobile App Conventions (React Native + Expo 54 + Expo Router)

## Navigation

- **Expo Router** (file-based routing) in `app/` directory
- Tabs: Home, Categories, Orders, Profile (in `app/(tabs)/`)
- Stack screens registered in `app/_layout.tsx` — every new screen needs a `<Stack.Screen>` entry:
  ```tsx
  <Stack.Screen name="screen-name" options={{ headerShown: true, title: "Title" }} />
  ```
  Without this, the screen inherits `headerShown: false` and content overlaps the status bar.

## API Calls

Use the `api` helper from `lib/api.ts` (NOT raw fetch):
```ts
import { api } from "../lib/api";

// GET — returns { success, data }
const res = await api.get<MyType>("/api/v1/resource");
const data = res.data; // already unwrapped from ApiResponse

// GET list — returns { success, data[], meta }
const res = await api.getList<MyType>("/api/v1/resource?page=1");

// POST
const res = await api.post<MyType>("/api/v1/resource", { field: "value" });
```

The helper auto-attaches Bearer token and handles 401 token refresh.

## Auth

- Tokens stored in `expo-secure-store` (NOT AsyncStorage)
- `useAuth()` from `lib/auth-context.tsx` — provides `isAuthenticated`, `user`, `login`, `logout`, `refreshUser`
- OTP login: any 10-digit phone, OTP `123456`

## State / Context

| Context | Hook | Provides |
|---------|------|----------|
| `AuthProvider` | `useAuth()` | `isAuthenticated`, `user`, `login`, `logout` |
| `StoreProvider` | `useStore()` | `stores`, `selectedStore`, `setSelectedStore` |
| `CartProvider` | `useCart()` | `items`, `addItem`, `removeItem`, `storeId` |
| `ToastProvider` | `useToast()` | `show(message, type)` |
| `WishlistProvider` | `useWishlist()` | `items`, `toggle`, `isWished` |

**Important**: `useStore()` returns `selectedStore` (Store object), NOT `storeId`. Derive it:
```ts
const { selectedStore } = useStore();
const storeId = selectedStore?.id;
```

## Screen Pattern

```tsx
import { useState, useCallback, useEffect } from "react";
import { View, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";

export default function MyScreen() {
  const [data, setData] = useState<MyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get<MyType>("/api/v1/resource");
      setData(res.data);
    } catch {
      // silently fail or show toast
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <ActivityIndicator />;
  // render content
}
```

**Critical**: If your fetch has an early return (e.g., `if (!storeId) return`), always set `loading = false` before returning, or the screen hangs on spinner forever.

## Design Tokens

```
Colors:
  primary: #0d9488 (teal-600)     background: #f8fafc (slate-50)
  surface: #ffffff                 text: #0f172a (slate-900)
  textSecondary: #64748b           border: #e2e8f0 (slate-200)
  success: #16a34a                 warning: #f59e0b
  error: #ef4444

Spacing: 4, 8, 12, 16, 20, 24, 32
Border Radius: 6 (sm), 8 (md), 12 (lg), 20 (pill)
Font Sizes: 11 (caption), 13 (sm), 15 (body), 17 (subtitle), 20 (title), 24 (heading)
```

## Styling

- Use `StyleSheet.create` (NOT inline objects for repeated styles)
- Import from `constants/theme` for consistent tokens
- Touch targets minimum 44x44px
- Use `FlatList` for lists (NOT `ScrollView` with `.map()`)
