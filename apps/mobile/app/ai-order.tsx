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
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useCart } from "../lib/cart-context";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { colors, fonts } from "../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ── Types ───────────────────────────────────────────
interface AIProduct {
  storeProductId: string;
  productId: string;
  name: string;
  brand: string | null;
  variant: string;
  price: number;
  originalPrice: number | null;
  inStock: boolean;
  imageUrl: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "loading" | "error";
  content: string;
  products?: AIProduct[];
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

// ── Product Card ────────────────────────────────────
function ProductCard({
  product,
  cartQty,
  onAdd,
  onUpdateQty,
}: {
  product: AIProduct;
  cartQty: number;
  onAdd: () => void;
  onUpdateQty: (qty: number) => void;
}) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  return (
    <View style={s.productCard}>
      <View style={s.productImageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={s.productImage} resizeMode="cover" />
        ) : (
          <View style={s.productImagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color="#cbd5e1" />
          </View>
        )}
        {hasDiscount && (
          <View style={s.discountBadge}>
            <Text style={s.discountBadgeText}>
              {Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)}% OFF
            </Text>
          </View>
        )}
      </View>

      <View style={s.productInfo}>
        <Text style={s.productName} numberOfLines={1}>{product.name}</Text>
        {product.brand && <Text style={s.productBrand} numberOfLines={1}>{product.brand}</Text>}
        <Text style={s.productVariant}>{product.variant}</Text>

        <View style={s.productPriceRow}>
          <Text style={s.productPrice}>{"\u20B9"}{product.price}</Text>
          {hasDiscount && (
            <Text style={s.productOriginalPrice}>{"\u20B9"}{product.originalPrice}</Text>
          )}
        </View>
      </View>

      {!product.inStock ? (
        <View style={s.outOfStockBtn}>
          <Text style={s.outOfStockText}>Out of stock</Text>
        </View>
      ) : cartQty > 0 ? (
        <View style={s.qtyRow}>
          <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdateQty(cartQty - 1)} activeOpacity={0.7}>
            <Ionicons name="remove" size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text style={s.qtyText}>{cartQty}</Text>
          <TouchableOpacity style={s.qtyBtn} onPress={() => onUpdateQty(cartQty + 1)} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={onAdd} activeOpacity={0.7}>
          <Text style={s.addBtnText}>ADD</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────
export default function AIOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedStore } = useStore();
  const {
    items: cartItems,
    addItem,
    updateQuantity,
    storeId: cartStoreId,
    itemCount,
  } = useCart();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replaceCartConfirm, setReplaceCartConfirm] = useState<{ pending: () => void } | null>(null);
  const listRef = useRef<FlatList>(null);
  const lastUserMessageRef = useRef<string>("");

  // Cart quantity lookup by storeProductId
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.storeProductId, item.quantity);
    }
    return map;
  }, [cartItems]);

  // Build messages array for API (only user/assistant, last 20)
  const apiMessages = useMemo(() => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [messages]);

  // Build cart payload for API
  const cartPayload = useMemo(() => {
    return cartItems.map((item) => ({
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      price: item.price,
    }));
  }, [cartItems]);

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
          products: AIProduct[];
          actions: unknown[];
        }>("/api/v1/ai/chat", {
          storeId: selectedStore.id,
          messages: allMessages.slice(-20),
          cart: cartPayload,
        });

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: res.data.message,
          products: res.data.products?.length > 0 ? res.data.products : undefined,
        };

        setMessages((prev) => prev.filter((m) => m.role !== "loading").concat(assistantMsg));
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
    [selectedStore, sending, apiMessages, cartPayload],
  );

  const handleRetry = useCallback(() => {
    // Remove the error message and resend
    setMessages((prev) => prev.filter((m) => m.role !== "error"));
    if (lastUserMessageRef.current) {
      sendMessage(lastUserMessageRef.current);
    }
  }, [sendMessage]);

  const handleAddToCart = useCallback(
    (product: AIProduct) => {
      if (!selectedStore) return;

      const item = {
        storeProductId: product.storeProductId,
        productId: product.productId,
        productName: product.name,
        variantId: product.storeProductId,
        variantName: product.variant,
        price: product.price,
        imageUrl: product.imageUrl,
      };

      if (cartStoreId && cartStoreId !== selectedStore.id) {
        setReplaceCartConfirm({
          pending: () => addItem(selectedStore.id, selectedStore.name, item),
        });
        return;
      }

      addItem(selectedStore.id, selectedStore.name, item);
    },
    [selectedStore, cartStoreId, addItem],
  );

  const handleUpdateQty = useCallback(
    (storeProductId: string, qty: number) => {
      updateQuantity(storeProductId, qty);
    },
    [updateQuantity],
  );

  // Inverted FlatList renders items bottom-to-top, so reverse the data
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Welcome message (static, shown at the bottom of inverted list = top visually)
  const welcomeContent = selectedStore
    ? `Hi! I'm your Martly AI assistant for ${selectedStore.name}. Tell me what you'd like to order \u2014 for example, "I need milk and bread" or "show me snacks".`
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
              <Ionicons name="sparkles" size={10} color="#fff" />
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

      // Assistant message
      return (
        <View style={s.assistantBubbleWrap}>
          <View style={s.aiBadge}>
            <Ionicons name="sparkles" size={10} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.assistantBubble}>
              <Text style={s.assistantBubbleText}>{item.content}</Text>
            </View>

            {item.products && item.products.length > 0 && (
              <FlatList
                horizontal
                data={item.products}
                keyExtractor={(p) => p.storeProductId}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.productList}
                renderItem={({ item: product }) => (
                  <ProductCard
                    product={product}
                    cartQty={cartQtyMap.get(product.storeProductId) ?? 0}
                    onAdd={() => handleAddToCart(product)}
                    onUpdateQty={(qty) => handleUpdateQty(product.storeProductId, qty)}
                  />
                )}
              />
            )}
          </View>
        </View>
      );
    },
    [cartQtyMap, handleAddToCart, handleUpdateQty, handleRetry],
  );

  // ── Quick Suggestion Chips ──
  const suggestions = ["Show categories", "Today's deals", "What's popular?"];

  const hasConversation = messages.length > 0;

  // ── No Store Selected ──
  if (!selectedStore) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.emptyState}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="storefront-outline" size={40} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>No store selected</Text>
          <Text style={s.emptySubtitle}>
            Please select a store from the home screen to start ordering with AI.
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
            <Ionicons name="sparkles" size={16} color={colors.primary} />
            <Text style={s.headerTitle}>Martly AI</Text>
          </View>
          <Text style={s.headerSubtitle} numberOfLines={1}>{selectedStore.name}</Text>
        </View>

        <TouchableOpacity
          style={s.headerCartBtn}
          onPress={() => router.push("/checkout")}
          activeOpacity={0.7}
        >
          <Ionicons name="cart-outline" size={22} color={colors.text} />
          {itemCount > 0 && (
            <View style={s.cartBadge}>
              <Text style={s.cartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
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
            // Welcome message at the top (footer because inverted)
            <View style={s.welcomeWrap}>
              <View style={s.welcomeIconCircle}>
                <Ionicons name="sparkles" size={24} color={colors.primary} />
              </View>
              <Text style={s.welcomeTitle}>Martly AI</Text>
              <Text style={s.welcomeText}>{welcomeContent}</Text>
            </View>
          }
        />

        {/* ── Bottom Input Area ── */}
        <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Quick suggestions */}
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
              placeholder="Ask me anything..."
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

      <ConfirmSheet
        visible={replaceCartConfirm !== null}
        title="Replace Cart?"
        message="Your cart has items from another store. Adding this item will replace your current cart."
        icon="cart-outline"
        iconColor="#f59e0b"
        confirmLabel="Replace"
        onConfirm={() => {
          replaceCartConfirm?.pending();
          setReplaceCartConfirm(null);
        }}
        onCancel={() => setReplaceCartConfirm(null)}
      />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────
const PRODUCT_CARD_W = 144;

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
  headerCartBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f3",
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: "#fff",
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

  // ── Product List & Cards ──
  productList: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  productCard: {
    width: PRODUCT_CARD_W,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  productImageWrap: {
    width: PRODUCT_CARD_W,
    height: 96,
    backgroundColor: "#f8faf9",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f3",
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#ef4444",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  productInfo: {
    padding: 10,
    paddingBottom: 0,
  },
  productName: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.text,
    lineHeight: 17,
  },
  productBrand: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  productVariant: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#94a3b8",
    marginTop: 2,
  },
  productPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  productPrice: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  productOriginalPrice: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },

  // ── Add / Qty Buttons ──
  addBtn: {
    margin: 10,
    marginTop: 8,
    backgroundColor: colors.primary + "12",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 10,
    marginTop: 8,
    gap: 0,
    backgroundColor: colors.primary + "12",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  qtyBtn: {
    width: 34,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary,
    minWidth: 24,
    textAlign: "center",
  },
  outOfStockBtn: {
    margin: 10,
    marginTop: 8,
    backgroundColor: "#f1f5f3",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
  },
  outOfStockText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "#94a3b8",
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
