import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { colors, spacing } from "../constants/theme";
import { resolveNotificationDeepLink } from "../lib/notification-helpers";
import { useNotifications } from "../lib/notification-context";
import { NotificationDetailSheet } from "../components/NotificationDetailSheet";
import type { AppNotification } from "../lib/types";

const TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
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

const DEFAULT_CONFIG = { icon: "notifications" as keyof typeof Ionicons.glyphMap, bg: "#f1f5f9", color: "#64748b" };

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
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { decrementUnread, resetUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);

  const fetchNotifications = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      const res = await api.getList<AppNotification>(`/api/v1/notifications?page=${pageNum}&pageSize=20`);
      const items = res.data;
      if (replace) {
        setNotifications(items);
      } else {
        setNotifications((prev) => [...prev, ...items]);
      }
      setHasMore(pageNum < (res.meta?.totalPages ?? 1));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, false);
  }, [hasMore, loadingMore, page, fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await api.patch("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      resetUnreadCount(0);
    } catch {
      // silently fail
    }
  }, [resetUnreadCount]);

  const handleTap = useCallback((notification: AppNotification) => {
    // Mark as read optimistically
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
      api.patch(`/api/v1/notifications/${notification.id}/read`).catch(() => {});
      decrementUnread();
    }

    setSelected(notification);
  }, [decrementUnread]);

  const handleSheetAction = useCallback(() => {
    if (!selected) return;
    const target = resolveNotificationDeepLink(selected.data as Record<string, unknown> | null);
    setSelected(null);
    router.push(target);
  }, [selected, router]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const config = TYPE_CONFIG[item.type] ?? DEFAULT_CONFIG;

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.cardUnread]}
        activeOpacity={0.7}
        onPress={() => handleTap(item)}
      >
        <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardTime}>{relativeTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Mark All Read bar */}
      {unreadCount > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>{unreadCount} unread</Text>
          <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="notifications-off-outline" size={40} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptySubtitle}>
              We'll notify you about orders, offers, and more
            </Text>
          </View>
        }
      />

      <NotificationDetailSheet
        notification={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
        onAction={handleSheetAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faf9",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8faf9",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  topBarText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  listContent: {
    paddingVertical: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardUnread: {
    backgroundColor: "#f0fdf4",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 11,
    color: "#94a3b8",
  },
  cardBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginLeft: 4,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
});
