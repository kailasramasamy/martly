import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Loader } from "../../components/Loader";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { colors, spacing, fontSize, fonts } from "../../constants/theme";
import { withSignIn } from "../../components/SignInPrompt";
import { strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";
import { useLanguage } from "../../lib/language-context";
import type { StoreLabel } from "../../lib/types";
import { formatDate, formatTime } from "../../lib/i18n/format";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TicketMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  messages: TicketMessage[];
  createdAt: string;
  store: StoreLabel | null;
  order: { id: string; status: string } | null;
}

const TICKET_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  OPEN: { color: "#92400e", bg: "#fef3c7" },
  RESOLVED: { color: "#166534", bg: "#dcfce7" },
  CLOSED: { color: "#475569", bg: "#f1f5f9" },
};

const ROLE_CONFIG: Record<string, { bubbleBg: string; textColor: string; align: "right" | "left"; badgeBg: string; badgeColor: string }> = {
  user: { bubbleBg: "#3b82f6", textColor: "#fff", align: "right", badgeBg: "#3b82f6", badgeColor: "#fff" },
  assistant: { bubbleBg: "#fff", textColor: colors.text, align: "left", badgeBg: colors.primary, badgeColor: "#fff" },
  admin: { bubbleBg: "#fff", textColor: colors.text, align: "left", badgeBg: "#f59e0b", badgeColor: "#fff" },
};

function SupportTicketDetailScreen() {
  const t = useStrings("subscriptions");
  const { getLocalizedName } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTicket = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const res = await api.get<SupportTicket[]>("/api/v1/support/my-tickets");
      const found = res.data.find((t) => t.id === id);
      if (found) setTicket(found);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchTicket();
    }, [fetchTicket])
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader size="large" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={40} color="#94a3b8" />
        <Text style={styles.errorText}>{t.tickets.notFound}</Text>
      </View>
    );
  }

  const cfg = TICKET_STATUS_CONFIG[ticket.status] ?? TICKET_STATUS_CONFIG.OPEN;
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];

  return (
    <View style={styles.container}>
      <FlatList keyboardDismissMode="on-drag"
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.messageList}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Subject + Status */}
            <View style={styles.subjectRow}>
              <Text style={styles.subject}>{ticket.subject}</Text>
              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{t.tickets.status[ticket.status]}</Text>
              </View>
            </View>

            {/* Ticket Meta */}
            <View style={styles.metaCard}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaLabel}>{t.tickets.created}</Text>
                <Text style={styles.metaValue}>
                  {formatDate(ticket.createdAt, { year: "numeric", month: "short", day: "numeric" })}
                </Text>
              </View>
              {ticket.store && (
                <View style={styles.metaItem}>
                  <Ionicons name="storefront-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaLabel}>{t.list.store}</Text>
                  <Text style={styles.metaValue}>{getLocalizedName(ticket.store)}</Text>
                </View>
              )}
              {ticket.order && (
                <View style={styles.metaItem}>
                  <Ionicons name="receipt-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaLabel}>{t.tickets.orderLabel}</Text>
                  <Text style={styles.metaValue}>#{ticket.order.id.slice(0, 8)}</Text>
                </View>
              )}
            </View>

            {/* Conversation header */}
            <Text style={styles.conversationTitle}>{t.tickets.conversation}</Text>

            {/* Pending notice for open tickets */}
            {ticket.status === "OPEN" && (
              <View style={styles.pendingNotice}>
                <Ionicons name="time-outline" size={16} color="#92400e" />
                <Text style={styles.pendingNoticeText}>
                  {t.tickets.pending}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const roleCfg = ROLE_CONFIG[item.role] ?? ROLE_CONFIG.assistant;
          const isUser = roleCfg.align === "right";
          const time = item.timestamp
            ? formatTime(item.timestamp, { hour: "2-digit", minute: "2-digit" })
            : "";

          return (
            <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
              {!isUser && (
                <View style={[styles.roleBadge, { backgroundColor: roleCfg.badgeBg }]}>
                  <Ionicons
                    name={item.role === "admin" ? "person" : "headset"}
                    size={10}
                    color={roleCfg.badgeColor}
                  />
                </View>
              )}
              <View style={{ maxWidth: SCREEN_WIDTH - 90 }}>
                {!isUser && (
                  <Text style={styles.roleLabel}>{t.tickets.roles[item.role in ROLE_CONFIG ? (item.role as keyof typeof t.tickets.roles) : "assistant"]}</Text>
                )}
                <View
                  style={[
                    styles.bubble,
                    { backgroundColor: roleCfg.bubbleBg },
                    isUser ? styles.bubbleUser : styles.bubbleOther,
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: roleCfg.textColor }]}>
                    {item.content}
                  </Text>
                </View>
                {time ? <Text style={[styles.timeText, isUser && styles.timeTextRight]}>{time}</Text> : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Ionicons name="chatbubbles-outline" size={28} color="#cbd5e1" />
            <Text style={styles.emptyMessagesText}>{t.tickets.noMessages}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f3" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { fontSize: fontSize.lg, fontFamily: fonts.medium, color: colors.textSecondary },

  messageList: { paddingBottom: 24 },

  // Header section
  headerSection: { padding: spacing.md, paddingBottom: 8 },
  subjectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  subject: {
    flex: 1,
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.text,
    lineHeight: 24,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 2,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },

  // Meta card
  metaCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    width: 56,
  },
  metaValue: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
    color: colors.text,
    flex: 1,
  },

  // Conversation
  conversationTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 12,
  },

  // Pending notice
  pendingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  pendingNoticeText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#92400e",
    lineHeight: 18,
  },

  // Bubbles
  bubbleWrap: {
    marginBottom: 12,
    paddingHorizontal: spacing.md,
  },
  bubbleWrapRight: {
    alignItems: "flex-end",
  },
  bubbleWrapLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  roleBadge: {
    width: 22,
    height: 22,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  roleLabel: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    marginBottom: 3,
    marginLeft: 2,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bubbleUser: {
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    borderTopLeftRadius: 6,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    lineHeight: 22,
  },
  timeText: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: "#94a3b8",
    marginTop: 3,
    marginLeft: 4,
  },
  timeTextRight: {
    textAlign: "right",
    marginRight: 4,
    marginLeft: 0,
  },

  // Empty messages
  emptyMessages: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyMessagesText: {
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
  },
});

export default withSignIn(SupportTicketDetailScreen, "chatbubbles-outline", () => ({
  title: strings("subscriptions").tickets.detailSignInTitle,
  message: strings("subscriptions").tickets.detailSignInMessage,
}));
