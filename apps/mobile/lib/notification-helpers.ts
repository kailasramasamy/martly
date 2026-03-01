import type { Href } from "expo-router";

/**
 * Resolves notification data into a deep link target.
 * Used by both the notification center (notifications.tsx) and
 * the push notification tap handler (_layout.tsx).
 */
export function resolveNotificationDeepLink(
  data?: Record<string, unknown> | null,
): Href {
  if (!data) return "/(tabs)" as Href;

  // 1. Order detail
  if (data.orderId) {
    return `/order/${data.orderId}` as Href;
  }

  // 2. Product detail
  if (data.productId) {
    return `/product/${data.productId}` as Href;
  }

  // 3. Category browse
  if (data.categoryId) {
    return `/category/${data.categoryId}` as Href;
  }

  // 4. Store view
  if (data.storeId) {
    return `/store/${data.storeId}` as Href;
  }

  // 5. Named screens
  if (data.screen) {
    switch (data.screen) {
      case "wallet":
        return "/wallet" as Href;
      case "loyalty":
        return "/loyalty" as Href;
      case "write-review":
        return {
          pathname: "/write-review",
          params: data.orderId ? { orderId: String(data.orderId) } : {},
        } as Href;
      case "wishlist":
        return "/wishlist" as Href;
      case "orders":
        return "/(tabs)/orders" as Href;
      case "home":
        return "/(tabs)" as Href;
      case "search":
        return {
          pathname: "/search",
          params: data.query ? { q: String(data.query) } : {},
        } as Href;
      case "profile":
        return "/(tabs)/profile" as Href;
      case "categories":
        return "/(tabs)/categories" as Href;
      case "smart-reorder":
        return "/smart-reorder" as Href;
    }
  }

  // Fallback: go home
  return "/(tabs)" as Href;
}
