import type { Ionicons } from "@expo/vector-icons";
import { NotificationTypeLabels, type NotificationType } from "@martly/shared/constants";
import { colors } from "../constants/theme";

export interface NotificationTypeStyle {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  label: string;
}

type Look = Omit<NotificationTypeStyle, "label">;

const LOOKS: Record<NotificationType, Look> = {
  ORDER_CONFIRMED: { icon: "checkmark-circle", bg: "#dbeafe", color: "#2563eb" },
  ORDER_PREPARING: { icon: "restaurant", bg: "#ffedd5", color: "#ea580c" },
  ORDER_READY: { icon: "bag-check", bg: "#e0e7ff", color: "#4f46e5" },
  ORDER_OUT_FOR_DELIVERY: { icon: "bicycle", bg: "#f3e8ff", color: "#7c3aed" },
  ORDER_DELIVERED: { icon: "checkmark-done-circle", bg: "#dcfce7", color: "#16a34a" },
  ORDER_CANCELLED: { icon: "close-circle", bg: "#fee2e2", color: colors.error },
  WALLET_CREDITED: { icon: "wallet", bg: "#ccfbf1", color: colors.primary },
  WALLET_DEBITED: { icon: "wallet-outline", bg: "#ccfbf1", color: colors.primary },
  LOYALTY_POINTS_EARNED: { icon: "star", bg: "#fef3c7", color: "#d97706" },
  LOYALTY_POINTS_REDEEMED: { icon: "star-outline", bg: "#fef3c7", color: "#d97706" },
  PROMOTIONAL: { icon: "megaphone", bg: "#fce7f3", color: "#db2777" },
  GENERAL: { icon: "information-circle", bg: "#f1f5f9", color: "#475569" },
  WELCOME: { icon: "sparkles", bg: "#e0f2fe", color: "#0284c7" },
  REVIEW_REQUEST: { icon: "chatbubble-ellipses", bg: "#fff7ed", color: "#d97706" },
  NEW_ORDER: { icon: "storefront", bg: "#fef3c7", color: "#b45309" },
  PAYMENT: { icon: "card", bg: "#dbeafe", color: "#2563eb" },
  DELIVERY_UPDATE: { icon: "bicycle", bg: "#f3e8ff", color: "#7c3aed" },
  RETURN_UPDATE: { icon: "return-down-back", bg: "#ffedd5", color: "#ea580c" },
  SUPPORT_UPDATE: { icon: "chatbubbles", bg: "#e0f2fe", color: "#0284c7" },
  MEMBERSHIP: { icon: "star", bg: "#fef3c7", color: "#d97706" },
  SUBSCRIPTION: { icon: "repeat", bg: "#ccfbf1", color: colors.primary },
  REFERRAL: { icon: "gift", bg: "#fce7f3", color: "#db2777" },
  WISHLIST_ALERT: { icon: "heart", bg: "#fee2e2", color: colors.error },
  STORE_NOTICE: { icon: "storefront", bg: "#f1f5f9", color: "#475569" },
  STAFF_ORDER: { icon: "receipt", bg: "#fef3c7", color: "#b45309" },
  STAFF_STOCK: { icon: "cube", bg: "#ffedd5", color: "#ea580c" },
  STAFF_DELIVERY: { icon: "bicycle", bg: "#f3e8ff", color: "#7c3aed" },
  STAFF_SERVICE: { icon: "chatbubbles", bg: "#e0f2fe", color: "#0284c7" },
  STAFF_MARKETING: { icon: "megaphone", bg: "#fce7f3", color: "#db2777" },
  STAFF_TEAM: { icon: "people", bg: "#e0e7ff", color: "#4f46e5" },
  STAFF_FINANCE: { icon: "cash", bg: "#dcfce7", color: "#15803d" },
};

const DEFAULT_LOOK: Look = { icon: "notifications", bg: "#f1f5f9", color: colors.textSecondary };

export function notificationTypeStyle(type: string): NotificationTypeStyle {
  const known = type in LOOKS;
  return {
    ...(known ? LOOKS[type as NotificationType] : DEFAULT_LOOK),
    label: known ? NotificationTypeLabels[type as NotificationType] : "Notification",
  };
}
