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
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { notificationAudience, type NotificationAudience } from "@martly/shared/constants";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { colors, spacing } from "../constants/theme";
import { resolveNotificationDeepLink } from "../lib/notification-helpers";
import { usePersona } from "../lib/persona-context";
import { notificationTypeStyle } from "../lib/notification-types";
import { useNotifications } from "../lib/notification-context";
import { NotificationDetailSheet } from "../components/NotificationDetailSheet";
import type { AppNotification } from "../lib/types";
import { withSignIn } from "../components/SignInPrompt";

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

function NotificationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ audience?: string }>();
  const { persona } = usePersona();
  const audience: NotificationAudience =
    params.audience === "staff" || params.audience === "customer"
      ? params.audience
      : persona === "manage" ? "staff" : "customer";
  const { unreadCount: customerUnread, staffUnreadCount, decrementUnread, resetUnread, onNew } = useNotifications();
  const unreadCount = audience === "staff" ? staffUnreadCount : customerUnread;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);

  const fetchNotifications = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      const res = await api.getList<AppNotification>(`/api/v1/notifications?page=${pageNum}&pageSize=20&audience=${audience}`);
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
  }, [audience]);

  useEffect(() => {
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  useEffect(() => onNew((incoming) => {
    if (notificationAudience(incoming.type) !== audience) return;
    setNotifications((prev) => (prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]));
  }), [onNew, audience]);

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
      await api.patch(`/api/v1/notifications/read-all?audience=${audience}`);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      resetUnread(audience);
    } catch {
      // silently fail
    }
  }, [audience, resetUnread]);

  const handleTap = useCallback((notification: AppNotification) => {
    // Mark as read optimistically
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
      api.patch(`/api/v1/notifications/${notification.id}/read`).catch(() => {});
      decrementUnread(audience);
    }

    setSelected(notification);
  }, [audience, decrementUnread]);

  const handleSheetAction = useCallback(() => {
    if (!selected) return;
    const target = resolveNotificationDeepLink(selected.data, selected.type);
    setSelected(null);
    router.push(target);
  }, [selected, router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const config = notificationTypeStyle(item.type);

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

  const isStaff = audience === "staff";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: isStaff ? "Alerts" : "Notifications" }} />
      {unreadCount > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.topBarText}>{unreadCount} unread</Text>
          <TouchableOpacity onPress={handleMarkAllRead} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
            <Text style={styles.markAllText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList keyboardDismissMode="on-drag"
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
            <Text style={styles.emptyTitle}>{isStaff ? "No alerts yet" : "No notifications yet"}</Text>
            <Text style={styles.emptySubtitle}>
              {isStaff ? "New orders, stock and team alerts show up here" : "We'll notify you about orders, offers, and more"}
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

export default withSignIn(NotificationsScreen, { icon: "notifications-outline", title: "Notifications", message: "Sign in to get order updates and offers." });
