import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { colors, fonts } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Types ───────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "loading" | "error" | "ticket";
  content: string;
  ticketId?: string;
}

// ── Typing Indicator ────────────────────────────────
function TypingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={s.typingRow}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[s.typingDot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────
export default function SupportChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedStore } = useStore();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const lastUserMessageRef = useRef<string>("");

  // Build messages array for API
  const apiMessages = useMemo(() => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !selectedStore || sending) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      const loadingMsg: ChatMessage = {
        id: `loading-${Date.now()}`,
        role: "loading",
        content: "",
      };

      lastUserMessageRef.current = text.trim();
      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setInput("");
      setSending(true);

      try {
        const allMessages = [
          ...apiMessages,
          { role: "user" as const, content: text.trim() },
        ];

        const res = await api.post<{
          message: string;
          ticketCreated: boolean;
          ticketId?: string;
        }>("/api/v1/support/chat", {
          storeId: selectedStore.id,
          messages: allMessages.slice(-20),
          orderId: orderId || undefined,
        });

        const newMessages: ChatMessage[] = [];

        // Assistant text message
        newMessages.push({
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: res.data.message,
        });

        // Ticket created card
        if (res.data.ticketCreated && res.data.ticketId) {
          newMessages.push({
            id: `ticket-${Date.now()}`,
            role: "ticket",
            content: "Support ticket created successfully. Our team will review your issue and get back to you.",
            ticketId: res.data.ticketId,
          });
        }

        setMessages((prev) =>
          prev.filter((m) => m.role !== "loading").concat(newMessages),
        );
      } catch {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "error",
          content: "Something went wrong. Please try again.",
        };
        setMessages((prev) => prev.filter((m) => m.role !== "loading").concat(errorMsg));
      } finally {
        setSending(false);
      }
    },
    [selectedStore, sending, apiMessages, orderId],
  );

  const handleRetry = useCallback(() => {
    setMessages((prev) => prev.filter((m) => m.role !== "error"));
    if (lastUserMessageRef.current) {
      sendMessage(lastUserMessageRef.current);
    }
  }, [sendMessage]);

  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const welcomeContent = selectedStore
    ? `Hi! I'm here to help with any issues \u2014 orders, payments, deliveries, or anything else. How can I assist you today?`
    : "";

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.role === "user") {
        return (
          <View style={s.userBubbleWrap}>
            <View style={s.userBubble}>
              <Text style={s.userBubbleText}>{item.content}</Text>
            </View>
          </View>
        );
      }

      if (item.role === "loading") {
        return (
          <View style={s.assistantBubbleWrap}>
            <View style={s.aiBadge}>
              <Ionicons name="headset" size={10} color="#fff" />
            </View>
            <View style={s.assistantBubble}>
              <TypingDots />
            </View>
          </View>
        );
      }

      if (item.role === "error") {
        return (
          <View style={s.assistantBubbleWrap}>
            <View style={[s.aiBadge, { backgroundColor: colors.error }]}>
              <Ionicons name="alert" size={10} color="#fff" />
            </View>
            <View style={s.errorBubble}>
              <Text style={s.errorText}>{item.content}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={handleRetry} activeOpacity={0.7}>
                <Ionicons name="refresh" size={14} color={colors.primary} />
                <Text style={s.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      if (item.role === "ticket") {
        return (
          <View style={s.ticketCardWrap}>
            <View style={s.ticketCard}>
              <View style={s.ticketIconCircle}>
                <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
              </View>
              <Text style={s.ticketTitle}>Ticket Created</Text>
              <Text style={s.ticketText}>{item.content}</Text>
              <Text style={s.ticketId}>Ticket ID: {item.ticketId?.slice(0, 8)}...</Text>
              <TouchableOpacity
                style={s.viewTicketsLink}
                onPress={() => router.push("/support-tickets")}
                activeOpacity={0.7}
              >
                <Text style={s.viewTicketsLinkText}>View My Tickets</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        );
      }

      // Assistant message
      return (
        <View style={s.assistantBubbleWrap}>
          <View style={s.aiBadge}>
            <Ionicons name="headset" size={10} color="#fff" />
          </View>
          <View style={s.assistantBubble}>
            <Text style={s.assistantBubbleText}>{item.content}</Text>
          </View>
        </View>
      );
    },
    [handleRetry],
  );

  const suggestions = ["Where's my order?", "Payment issue", "Talk to a human"];
  const hasConversation = messages.length > 0;

  if (!selectedStore) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.emptyState}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="storefront-outline" size={40} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>No store selected</Text>
          <Text style={s.emptySubtitle}>
            Please select a store from the home screen to get support.
          </Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
            <Text style={s.emptyBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.headerBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <View style={s.headerTitleRow}>
            <Ionicons name="headset" size={16} color={colors.primary} />
            <Text style={s.headerTitle}>Martly Support</Text>
          </View>
          <Text style={s.headerSubtitle} numberOfLines={1}>{selectedStore.name}</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={s.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Messages ── */}
        <FlatList
          ref={listRef}
          data={invertedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={s.messageList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <View style={s.welcomeWrap}>
              <View style={s.welcomeIconCircle}>
                <Ionicons name="headset" size={24} color={colors.primary} />
              </View>
              <Text style={s.welcomeTitle}>Martly Support</Text>
              <Text style={s.welcomeText}>{welcomeContent}</Text>
              {orderId && (
                <View style={s.orderBanner}>
                  <Ionicons name="receipt-outline" size={16} color={colors.primary} />
                  <Text style={s.orderBannerText}>
                    Asking about Order #{orderId.slice(0, 8)}...
                  </Text>
                </View>
              )}
            </View>
          }
        />

        {/* ── Bottom Input Area ── */}
        <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!hasConversation && (
            <View style={s.suggestionsRow}>
              {suggestions.map((text) => (
                <TouchableOpacity
                  key={text}
                  style={s.suggestionChip}
                  onPress={() => sendMessage(text)}
                  activeOpacity={0.7}
                >
                  <Text style={s.suggestionChipText}>{text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.inputRow}>
            <TextInput
              style={s.textInput}
              placeholder="Describe your issue..."
              placeholderTextColor="#94a3b8"
              value={input}
              onChangeText={setInput}
              editable={!sending}
              multiline
              maxLength={500}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || sending}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f4f3",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ece9",
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f3",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // ── Keyboard / Messages ──
  keyboardView: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 16,
  },

  // ── Welcome ──
  welcomeWrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  welcomeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },

  // ── Order Banner ──
  orderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    backgroundColor: colors.primary + "12",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.primary + "25",
  },
  orderBannerText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primary,
  },

  // ── User Bubble ──
  userBubbleWrap: {
    alignItems: "flex-end",
    marginBottom: 12,
  },
  userBubble: {
    maxWidth: "78%",
    backgroundColor: colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubbleText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#fff",
    lineHeight: 21,
  },

  // ── Assistant Bubble ──
  assistantBubbleWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  aiBadge: {
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  assistantBubble: {
    maxWidth: SCREEN_WIDTH - 80,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  assistantBubbleText: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 22,
  },

  // ── Error Bubble ──
  errorBubble: {
    maxWidth: SCREEN_WIDTH - 80,
    backgroundColor: "#fef2f2",
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: "#991b1b",
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  retryBtnText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },

  // ── Ticket Card ──
  ticketCardWrap: {
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  ticketCard: {
    width: "100%",
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  ticketIconCircle: {
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#166534",
    marginBottom: 6,
  },
  ticketText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#15803d",
    textAlign: "center",
    lineHeight: 19,
  },
  ticketId: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#86efac",
    marginTop: 8,
  },
  viewTicketsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  viewTicketsLinkText: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },

  // ── Typing Dots ──
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#94a3b8",
  },

  // ── Input Area ──
  inputArea: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e8ece9",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  suggestionChip: {
    backgroundColor: colors.primary + "10",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + "25",
  },
  suggestionChipText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#f1f5f3",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.text,
    maxHeight: 100,
    minHeight: 42,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },

  // ── Empty State ──
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.primary + "14",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyBtnText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#fff",
  },
});
