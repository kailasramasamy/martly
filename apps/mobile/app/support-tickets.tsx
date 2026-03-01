import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { colors, spacing, fontSize, fonts } from "../constants/theme";
import { OrderCardSkeleton } from "../components/SkeletonLoader";

interface SupportTicket {
  id: string;
  subject: string;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  messages: { role: string; content: string; timestamp: string }[];
  createdAt: string;
  store: { id: string; name: string } | null;
  order: { id: string; status: string } | null;
}

const TICKET_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  OPEN: { color: "#92400e", bg: "#fef3c7", label: "Open" },
  RESOLVED: { color: "#166534", bg: "#dcfce7", label: "Resolved" },
  CLOSED: { color: "#475569", bg: "#f1f5f9", label: "Closed" },
};

export default function SupportTicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get<SupportTicket[]>("/api/v1/support/my-tickets");
      setTickets(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTickets();
    }, [fetchTickets])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTickets();
  }, [fetchTickets]);

  if (loading) {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3].map((i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tickets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={tickets.length === 0 ? styles.center : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubbles-outline" size={36} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No tickets yet</Text>
            <Text style={styles.emptySubtitle}>
              When you contact support, your tickets will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = TICKET_STATUS_CONFIG[item.status] ?? TICKET_STATUS_CONFIG.OPEN;
          const date = new Date(item.createdAt).toLocaleDateString();
          const messageCount = Array.isArray(item.messages) ? item.messages.length : 0;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/support-ticket/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.subject} numberOfLines={1}>{item.subject}</Text>
                <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                {item.store && (
                  <View style={styles.metaRow}>
                    <Ionicons name="storefront-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{item.store.name}</Text>
                  </View>
                )}
                {item.order && (
                  <View style={styles.metaRow}>
                    <Ionicons name="receipt-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.metaText}>Order #{item.order.id.slice(0, 8)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.date}>{date}</Text>
                <View style={styles.messageCountRow}>
                  <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.messageCount}>
                    {messageCount} message{messageCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  skeletonContainer: { padding: spacing.md },
  list: { padding: spacing.md },

  // Empty state
  emptyContainer: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  subject: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
  },

  // Card body
  cardBody: {
    gap: 4,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },

  // Card footer
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
  messageCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  messageCount: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
});
