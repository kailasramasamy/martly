import type { Href } from "expo-router";
import { notificationAudience } from "@martly/shared/constants";

type Data = Record<string, unknown>;

const str = (v: unknown) => String(v);

function withId(path: string, id: unknown, fallback: string): Href {
  return (id ? `${path}/${str(id)}` : fallback) as Href;
}

const STATIC_SCREENS: Record<string, string> = {
  wallet: "/wallet",
  loyalty: "/loyalty",
  subscriptions: "/subscriptions",
  "tomorrows-basket": "/tomorrows-basket",
  membership: "/membership",
  referral: "/referral",
  wishlist: "/wishlist",
  "smart-reorder": "/smart-reorder",
  home: "/(tabs)",
  orders: "/(tabs)/orders",
  profile: "/(tabs)/profile",
  categories: "/(tabs)/categories",
  "manage-orders": "/(manage)/orders",
  trip: "/(manage)/delivery",
  "manage-reviews": "/manage/reviews",
  "store-ratings": "/manage/store-ratings",
  "brand-ads": "/manage/brand-ads",
  "marketing-plan": "/manage/marketing-plan",
  "manage-subscriptions": "/manage/subscriptions",
  "manage-profile": "/manage/profile",
};

function resolveScreen(screen: string, data: Data): Href | null {
  if (STATIC_SCREENS[screen]) return STATIC_SCREENS[screen] as Href;
  const orderParams = data.orderId ? { orderId: str(data.orderId) } : {};
  switch (screen) {
    case "order": return data.orderId ? (`/order/${str(data.orderId)}` as Href) : null;
    // The review form needs a product; an order-level review request rates from the order screen
    case "write-review":
      if (data.productId) return { pathname: "/write-review", params: { ...orderParams, productId: str(data.productId) } } as Href;
      return data.orderId ? (`/order/${str(data.orderId)}` as Href) : null;
    case "live-tracking": return { pathname: "/live-tracking", params: orderParams } as Href;
    case "subscription": return data.subscriptionId ? (`/subscription/${str(data.subscriptionId)}` as Href) : null;
    case "support-ticket": return data.ticketId ? (`/support-ticket/${str(data.ticketId)}` as Href) : null;
    case "product": return data.productId ? (`/product/${str(data.productId)}` as Href) : null;
    case "collection": return data.collectionId ? (`/collection/${str(data.collectionId)}` as Href) : null;
    case "brand": return data.brandId ? (`/brand/${str(data.brandId)}` as Href) : null;
    case "search": return { pathname: "/search", params: data.query ? { q: str(data.query) } : {} } as Href;
    case "manage-order": return data.orderId ? (`/manage/orders/${str(data.orderId)}` as Href) : null;
    case "delivery-slots": return withId("/manage/delivery-slots", data.slotId, "/manage/delivery-slots");
    case "manage-return": return data.returnRequestId ? (`/manage/return-requests/${str(data.returnRequestId)}` as Href) : null;
    case "manage-ticket": return data.ticketId ? (`/manage/support-tickets/${str(data.ticketId)}` as Href) : null;
    case "stock":
      return { pathname: "/manage/stock/receive", params: data.storeProductId ? { storeProductId: str(data.storeProductId) } : {} } as Href;
    case "stock-count": return data.countId ? (`/manage/stock-counts/${str(data.countId)}` as Href) : null;
    case "catalog-draft": return withId("/manage/catalog-drafts", data.draftId, "/manage/catalog-drafts");
    case "promo": return data.promoId ? (`/manage/promos/${str(data.promoId)}` as Href) : null;
    case "campaign": return data.campaignId ? (`/manage/notification-send/campaigns/${str(data.campaignId)}` as Href) : null;
    default: return null;
  }
}

function resolveById(data: Data): Href | null {
  if (data.orderId) return `/order/${str(data.orderId)}` as Href;
  if (data.collectionId) return `/collection/${str(data.collectionId)}` as Href;
  if (data.productId) return `/product/${str(data.productId)}` as Href;
  if (data.categoryId) return `/category/${str(data.categoryId)}` as Href;
  if (data.storeId) return `/store/${str(data.storeId)}` as Href;
  return null;
}

// Staff alerts always carry a storeId, so an unresolved staff screen must not fall through to the shop's store page
const isStaffScreen = (screen: string) =>
  screen.startsWith("manage-") || ["trip", "delivery-slots", "store-ratings", "stock", "stock-count", "catalog-draft", "promo", "campaign", "brand-ads", "marketing-plan"].includes(screen);

/** Deep link for a notification's data, or null when it carries nothing to open */
export function notificationDeepLink(data?: Data | null): Href | null {
  if (!data) return null;
  if (typeof data.screen !== "string") return resolveById(data);
  const fromScreen = resolveScreen(data.screen, data);
  if (fromScreen) return fromScreen;
  return isStaffScreen(data.screen) ? ("/(manage)" as Href) : resolveById(data);
}

/**
 * Resolves notification data into a deep link target. Used by the notification center,
 * the in-app banner and the push tap handler. `type` picks the fallback home (Manage vs shop).
 */
export function resolveNotificationDeepLink(data?: Data | null, type?: string): Href {
  const target = notificationDeepLink(data);
  if (target) return target;
  const kind = type ?? (typeof data?.type === "string" ? data.type : undefined);
  const isStaff = kind ? notificationAudience(kind) === "staff" : false;
  return (isStaff ? "/(manage)" : "/(tabs)") as Href;
}
