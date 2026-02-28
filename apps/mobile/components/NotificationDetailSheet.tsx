import { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import type { AppNotification } from "../lib/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX = SCREEN_HEIGHT * 0.78;

const TYPE_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }
> = {
  ORDER_CONFIRMED: { icon: "checkmark-circle", bg: "#dbeafe", color: "#2563eb" },
  ORDER_PREPARING: { icon: "restaurant", bg: "#ffedd5", color: "#ea580c" },
  ORDER_READY: { icon: "bag-check", bg: "#e0e7ff", color: "#4f46e5" },
  ORDER_OUT_FOR_DELIVERY: { icon: "bicycle", bg: "#f3e8ff", color: "#7c3aed" },
  ORDER_DELIVERED: { icon: "checkmark-done-circle", bg: "#dcfce7", color: "#16a34a" },
  ORDER_CANCELLED: { icon: "close-circle", bg: "#fee2e2", color: "#dc2626" },
  WALLET_CREDITED: { icon: "wallet", bg: "#ccfbf1", color: "#0d9488" },
  WALLET_DEBITED: { icon: "wallet-outline", bg: "#ccfbf1", color: "#0d9488" },
  LOYALTY_POINTS_EARNED: { icon: "star", bg: "#fef3c7", color: "#d97706" },
  LOYALTY_POINTS_REDEEMED: { icon: "star-outline", bg: "#fef3c7", color: "#d97706" },
  PROMOTIONAL: { icon: "megaphone", bg: "#fce7f3", color: "#db2777" },
  GENERAL: { icon: "information-circle", bg: "#f1f5f9", color: "#475569" },
  WELCOME: { icon: "sparkles", bg: "#e0f2fe", color: "#0284c7" },
  REVIEW_REQUEST: { icon: "chatbubble-ellipses", bg: "#fff7ed", color: "#d97706" },
};

const DEFAULT_CONFIG = {
  icon: "notifications" as keyof typeof Ionicons.glyphMap,
  bg: "#f1f5f9",
  color: "#64748b",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function hasDeepLink(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  return !!(
    data.orderId ||
    data.productId ||
    data.categoryId ||
    data.storeId ||
    data.screen
  );
}

interface Props {
  notification: AppNotification | null;
  visible: boolean;
  onClose: () => void;
  onAction: () => void;
}

export function NotificationDetailSheet({
  notification,
  visible,
  onClose,
  onAction,
}: Props) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SHEET_MAX)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SHEET_MAX,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!notification) return null;

  const config = TYPE_CONFIG[notification.type] ?? DEFAULT_CONFIG;
  const showAction = hasDeepLink(notification.data);

  return (
    <View style={styles.overlay} pointerEvents={visible ? "auto" : "none"}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.handleBar} />

        {/* Colored accent stripe */}
        <View style={[styles.accentStripe, { backgroundColor: config.color + "18" }]}>
          <View style={[styles.accentLine, { backgroundColor: config.color }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon} size={22} color={config.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>{notification.title}</Text>
            <Text style={styles.time}>{relativeTime(notification.createdAt)}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Banner image */}
        {notification.imageUrl && (
          <Image
            source={{ uri: notification.imageUrl }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        )}

        {/* Body (markdown) */}
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={styles.bodyContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <Markdown style={markdownStyles}>{notification.body}</Markdown>
        </ScrollView>

        {/* Action button */}
        {showAction && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: config.color }]}
            activeOpacity={0.85}
            onPress={onAction}
          >
            <Text style={styles.actionText}>View Details</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: "#0f172a",
  },
  heading1: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0d9488",
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0d9488",
    marginTop: 10,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0d9488",
    marginTop: 8,
    marginBottom: 4,
  },
  link: {
    color: "#0d9488",
    textDecorationLine: "underline",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#0d9488",
    backgroundColor: "#f0fdfa",
    paddingLeft: 12,
    paddingVertical: 6,
    marginVertical: 8,
  },
  code_inline: {
    backgroundColor: "#f1f5f9",
    color: "#0f172a",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: 13,
  },
  code_block: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    fontFamily: "monospace",
    fontSize: 13,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 8,
    fontFamily: "monospace",
    fontSize: 13,
    marginVertical: 8,
  },
  strong: {
    fontWeight: "700",
  },
  em: {
    fontStyle: "italic",
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
  paragraph: {
    marginVertical: 4,
  },
  hr: {
    backgroundColor: "#e2e8f0",
    height: 1,
    marginVertical: 12,
  },
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 32,
    maxHeight: SHEET_MAX,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  accentStripe: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 14,
    overflow: "hidden",
  },
  accentLine: {
    height: "100%",
    width: "100%",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
  },
  time: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerImage: {
    width: "auto",
    height: 160,
    borderRadius: 12,
    marginTop: 16,
    marginHorizontal: 16,
    backgroundColor: "#f1f5f9",
  },
  bodyScroll: {
    marginTop: 16,
    flexShrink: 1,
    paddingHorizontal: 16,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    marginHorizontal: 16,
  },
  actionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
