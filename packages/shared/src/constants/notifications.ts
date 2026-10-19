export const NotificationType = {
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  ORDER_PREPARING: "ORDER_PREPARING",
  ORDER_READY: "ORDER_READY",
  ORDER_OUT_FOR_DELIVERY: "ORDER_OUT_FOR_DELIVERY",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  WALLET_CREDITED: "WALLET_CREDITED",
  WALLET_DEBITED: "WALLET_DEBITED",
  LOYALTY_POINTS_EARNED: "LOYALTY_POINTS_EARNED",
  LOYALTY_POINTS_REDEEMED: "LOYALTY_POINTS_REDEEMED",
  PROMOTIONAL: "PROMOTIONAL",
  GENERAL: "GENERAL",
  WELCOME: "WELCOME",
  REVIEW_REQUEST: "REVIEW_REQUEST",
  NEW_ORDER: "NEW_ORDER",
  PAYMENT: "PAYMENT",
  DELIVERY_UPDATE: "DELIVERY_UPDATE",
  RETURN_UPDATE: "RETURN_UPDATE",
  SUPPORT_UPDATE: "SUPPORT_UPDATE",
  MEMBERSHIP: "MEMBERSHIP",
  SUBSCRIPTION: "SUBSCRIPTION",
  REFERRAL: "REFERRAL",
  WISHLIST_ALERT: "WISHLIST_ALERT",
  STORE_NOTICE: "STORE_NOTICE",
  STAFF_ORDER: "STAFF_ORDER",
  STAFF_STOCK: "STAFF_STOCK",
  STAFF_DELIVERY: "STAFF_DELIVERY",
  STAFF_SERVICE: "STAFF_SERVICE",
  STAFF_MARKETING: "STAFF_MARKETING",
  STAFF_TEAM: "STAFF_TEAM",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationTypeLabels: Record<NotificationType, string> = {
  ORDER_CONFIRMED: "Order Confirmed",
  ORDER_PREPARING: "Preparing Order",
  ORDER_READY: "Order Ready",
  ORDER_OUT_FOR_DELIVERY: "Out for Delivery",
  ORDER_DELIVERED: "Order Delivered",
  ORDER_CANCELLED: "Order Cancelled",
  WALLET_CREDITED: "Wallet Credited",
  WALLET_DEBITED: "Wallet Debited",
  LOYALTY_POINTS_EARNED: "Points Earned",
  LOYALTY_POINTS_REDEEMED: "Points Redeemed",
  PROMOTIONAL: "Promotional",
  GENERAL: "General",
  WELCOME: "Welcome",
  REVIEW_REQUEST: "Review Request",
  NEW_ORDER: "New Order",
  PAYMENT: "Payment",
  DELIVERY_UPDATE: "Delivery Update",
  RETURN_UPDATE: "Return Update",
  SUPPORT_UPDATE: "Support",
  MEMBERSHIP: "Membership",
  SUBSCRIPTION: "Subscription",
  REFERRAL: "Referral",
  WISHLIST_ALERT: "Wishlist",
  STORE_NOTICE: "Store Notice",
  STAFF_ORDER: "Orders",
  STAFF_STOCK: "Stock",
  STAFF_DELIVERY: "Delivery",
  STAFF_SERVICE: "Customer Service",
  STAFF_MARKETING: "Marketing",
  STAFF_TEAM: "Team",
};

/** Types that belong in the staff (Manage) inbox; everything else is a shopper notification */
export const STAFF_NOTIFICATION_TYPES: readonly NotificationType[] = [
  "NEW_ORDER", "STAFF_ORDER", "STAFF_STOCK", "STAFF_DELIVERY", "STAFF_SERVICE", "STAFF_MARKETING", "STAFF_TEAM",
];

export const NotificationAudience = { STAFF: "staff", CUSTOMER: "customer" } as const;
export type NotificationAudience = (typeof NotificationAudience)[keyof typeof NotificationAudience];

export function notificationAudience(type: string): NotificationAudience {
  return (STAFF_NOTIFICATION_TYPES as readonly string[]).includes(type) ? "staff" : "customer";
}
