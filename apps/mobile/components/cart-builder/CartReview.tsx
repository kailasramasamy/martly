import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, fonts } from "../../constants/theme";
import { api, ApiError } from "../../lib/api";
import { toCartItem, useCart } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { useStore } from "../../lib/store-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useReadAloud } from "../../lib/use-read-aloud";
import { useKeyboardReveal } from "../../lib/use-keyboard-reveal";
import { lineInCart, type BuiltLine, type ReviewState } from "../../lib/cart-builder";
import { ConfirmSheet } from "../ConfirmSheet";
import { rupees } from "../orders/format";
import { ReviewLine } from "./ReviewLine";

type Props = {
  review: ReviewState;
  onStartOver: () => void;
  /** Searches one line again with the shopper's new words */
  onResearch: (index: number, text: string) => void;
  onAdded?: (lines: number[]) => void;
};
type Sure = { line: BuiltLine; candidate: BuiltLine["candidates"][number] };

/**
 * Puts the lines we're sure of (brand named, or their usual) in the cart as each one arrives. When the cart holds
 * another store's items it asks once; if they'd rather keep that cart, nothing more is added for them.
 */
function usePreAdd(review: ReviewState) {
  const { selectedStore } = useStore();
  const { storeId: cartStoreId, items, addItems } = useCart();
  const { isMember } = useMembership();
  const [askReplace, setAskReplace] = useState(false);
  // By line, not position: a re-searched line that splits in two shifts the ones after it
  const handled = useRef(new WeakSet<BuiltLine>());
  const declined = useRef(false);
  const waiting: Sure[] = review.lines.flatMap(({ line }) =>
    line?.confidence === "MATCHED" && line.candidates[0] && !handled.current.has(line) ? [{ line, candidate: line.candidates[0] }] : []);
  const waitingKey = waiting.map((w) => w.candidate.storeProduct.id).join();

  const add = useCallback((sure: Sure[]) => {
    setAskReplace(false);
    if (!selectedStore) return;
    sure.forEach((s) => handled.current.add(s.line));
    // Opening the same list again mustn't double what's already in the cart
    const fresh = sure.filter((s) => !items.some((i) => i.storeProductId === s.candidate.storeProduct.id));
    if (fresh.length) addItems(selectedStore, fresh.map((s) => toCartItem(s.candidate.storeProduct, s.candidate.quantity, isMember)));
  }, [selectedStore, items, addItems, isMember]);

  useEffect(() => {
    if (!selectedStore || !waitingKey || askReplace || declined.current) return;
    if (cartStoreId && cartStoreId !== selectedStore.id && items.length > 0) setAskReplace(true);
    else add(waiting);
  }, [waitingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => {
    declined.current = true;
    setAskReplace(false);
  };
  return { askReplace, confirm: () => add(waiting), cancel, storeName: selectedStore?.name };
}

/** Heads to the cart, recording per line what the shopper kept (to measure how often our first match was right) */
function useViewCart({ review, onAdded }: Props, inCart: (ReturnType<typeof lineInCart>)[], beforeLeave: () => void) {
  return () => {
    beforeLeave();
    const chosen = inCart.map((c, line) => ({ line, storeProductId: c?.sp.id ?? null, quantity: c?.quantity ?? 0 }));
    // Only measures match quality (once the run is logged, and while it still matches the screen); a lost outcome
    // must not stop the shopper reaching their cart
    if (review.runId && !review.edited) {
      api.post(`/api/v1/list-to-cart/${review.runId}/outcome`, { chosen }).catch((err) => {
        if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      });
    }
    onAdded?.(inCart.flatMap((c, i) => (c ? [i] : [])));
    router.replace("/(tabs)/cart");
  };
}

/** Reads the list's items in the cart and their total aloud; a second tap stops it */
function useReadCart(added: NonNullable<ReturnType<typeof lineInCart>>[]) {
  const t = useStrings("shoppingList");
  const { isMember } = useMembership();
  const { getLocalizedName } = useLanguage();
  const voice = useReadAloud();
  const toggle = () => {
    if (voice.speaking) return voice.stop();
    const total = added.reduce((sum, a) => sum + getBestPrice(a.sp, isMember) * a.quantity, 0);
    voice.speak(`${added.map((a) => `${a.quantity} ${getLocalizedName(a.sp.product)} ${a.sp.variant.name}`).join(", ")}. ${t.spokenTotal(rupees(total))}`);
  };
  return { ...voice, toggle };
}

function ReviewHeader({ ready, count, onRead, speaking, canRead }: { ready: number; count: number; onRead: () => void; speaking: boolean; canRead: boolean }) {
  const t = useStrings("shoppingList");
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t.reviewTitle(ready, count)}</Text>
        {canRead && (
          <TouchableOpacity style={styles.speaker} onPress={onRead} accessibilityRole="button">
            <Ionicons name={speaking ? "stop" : "volume-high"} size={20} color={colors.primary} />
            <Text style={styles.speakerText}>{speaking ? t.stopReading : t.readAloud}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>{t.reviewHint}</Text>
    </View>
  );
}

/** The matched list as the store's product cards, line by line: what we were sure of is already in the cart */
function ReviewBody(props: Props) {
  const { review, onStartOver } = props;
  const t = useStrings("shoppingList");
  const tr = useStrings("orders").reorder;
  const { items, itemCount, totalAmount } = useCart();
  const pre = usePreAdd(review);
  const quantities = useMemo(() => new Map(items.map((i) => [i.storeProductId, i.quantity])), [items]);
  const inCart = review.lines.map(({ line }) => (line ? lineInCart(line, quantities) : null));
  const added = inCart.flatMap((c) => (c ? [c] : []));
  const voice = useReadCart(added);
  const viewCart = useViewCart(props, inCart, voice.stop);
  // Re-wording a line opens the keyboard: keep the field and View cart above it
  const keyboard = useKeyboardReveal<FlatList<ReviewState["lines"][number]>>();


  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
        <FlatList
          ref={keyboard.scrollRef} onScroll={keyboard.onScroll} scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={review.lines}
          keyExtractor={(entry) => entry.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<ReviewHeader ready={added.length} count={review.lines.length} onRead={voice.toggle} speaking={voice.speaking} canRead={voice.available && added.length > 0} />}
          ItemSeparatorComponent={() => <View style={styles.gap} />}
          renderItem={({ item, index }) => <ReviewLine entry={item} inCart={inCart[index] !== null} onResearch={(text) => props.onResearch(index, text)} />}
          ListFooterComponent={
            <TouchableOpacity style={styles.startOver} onPress={onStartOver}>
              <Ionicons name="mic-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.startOverText}>{t.startOver}</Text>
            </TouchableOpacity>
          }
        />
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.cta, itemCount === 0 && styles.ctaDisabled]} disabled={itemCount === 0} onPress={viewCart} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{itemCount ? t.viewCart(itemCount, rupees(totalAmount)) : t.addToContinue}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <ConfirmSheet
        visible={pre.askReplace} title={tr.replaceCartTitle} message={t.replaceCartMessage(pre.storeName)}
        icon="cart-outline" iconColor={colors.primary} confirmLabel={tr.replaceCart} destructive={false}
        onConfirm={pre.confirm} onCancel={pre.cancel}
      />
    </View>
  );
}

/**
 * Reviewing a spoken or written list against the store. ADD on a card puts it straight in the cart (with the
 * size sheet and the replace-cart prompt every product list has). `onAdded` gets the lines in the cart on leaving.
 */
export function CartReview(props: Props) {
  const { selectedStore } = useStore();
  return (
    <ProductActionsProvider store={selectedStore}>
      <ReviewBody {...props} />
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  list: { padding: 16, paddingBottom: 24 },
  gap: { height: 12 },
  header: { marginBottom: 14, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  hint: { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  speaker: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: "#ccfbf1" },
  speakerText: { fontSize: 14, fontFamily: fonts.bold, color: colors.primary },
  startOver: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, marginTop: 16 },
  startOverText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textSecondary },
  footer: { padding: 16, paddingBottom: 24, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: colors.border },
  cta: { backgroundColor: colors.accent, borderRadius: 26, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  ctaDisabled: { backgroundColor: "#fde68a" },
  ctaText: { fontSize: 16, fontFamily: fonts.bold, color: colors.accentText, textAlign: "center" },
});
