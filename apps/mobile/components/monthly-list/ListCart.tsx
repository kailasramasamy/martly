import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { cartTotals, CartScope, toCartItem, useCart, type CartItem, type CartState, type CartStore } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useMembership } from "../../lib/membership-context";
import { useStore } from "../../lib/store-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { MonthlyList } from "../../lib/types";
import { Loader } from "../Loader";
import { linesOf, useMonthlyList, type ListLine } from "./use-monthly-list";
import { queueListSave } from "./list-saves";

// Adds the lines' packs to any already there, else appends them
const merge = (prev: CartItem[], lines: CartItem[]) => lines.reduce((next, line) => {
  const at = next.findIndex((i) => i.storeProductId === line.storeProductId);
  return at >= 0 ? next.map((i, n) => (n === at ? { ...i, quantity: i.quantity + line.quantity } : i)) : [...next, line];
}, prev);

// The cart's actions, working on the list's lines instead
function useListBasket(list: MonthlyList, store: CartStore) {
  const { isMember } = useMembership();
  const { getLocalizedName } = useLanguage();
  const { pendingCoupon, setPendingCoupon } = useCart();
  const [items, setItems] = useState<CartItem[]>(() =>
    list.items.flatMap((i) => (i.listing ? [toCartItem(i.listing, i.quantity, isMember)] : [])));
  const value = useMemo<CartState>(() => {
    const without = (spId: string) => setItems((prev) => prev.filter((i) => i.storeProductId !== spId));
    return {
      store, storeId: store.id, storeName: getLocalizedName(store), items, pendingCoupon, setPendingCoupon, ...cartTotals(items),
      addItem: (_, item) => setItems((prev) => merge(prev, [{ ...item, quantity: 1 }])),
      addItems: (_, lines) => setItems((prev) => merge(prev, lines)),
      removeItem: without,
      updateQuantity: (spId, quantity) => (quantity <= 0 ? without(spId)
        : setItems((prev) => prev.map((i) => (i.storeProductId === spId ? { ...i, quantity } : i)))),
      replaceItem: (spId, line) => setItems((prev) => prev.map((i) => (i.storeProductId === spId ? line : i))),
      repriceItems: (terms) => setItems((prev) => prev.map((i) => (terms.has(i.storeProductId) ? { ...i, ...terms.get(i.storeProductId)! } : i))),
      clearCart: () => setItems([]),
      replaceCart: (_, lines) => setItems(lines),
      restoreItems: (_, lines) => setItems((prev) => merge(prev, lines.map((l) => l.item))),
    };
  }, [items, store, getLocalizedName, pendingCoupon, setPendingCoupon]);
  return value;
}

// Each change goes to the list; lines the store doesn't list today stay on it untouched
function ListBasketScope({ list, store, save, children }: { list: MonthlyList; store: CartStore; save: (lines: ListLine[]) => Promise<boolean>; children: ReactNode }) {
  const value = useListBasket(list, store);
  const [unlisted] = useState(() => linesOf({ ...list, items: list.items.filter((i) => !i.listing) }));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const lines = [...value.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })), ...unlisted];
    queueListSave(() => save(lines));
  }, [value.items, unlisted, save]);
  return <CartScope value={value}>{children}</CartScope>;
}

/** For the screens inside, the monthly list stands in for the cart: what they add goes on the list */
export function ListCart({ children }: { children: ReactNode }) {
  const t = useStrings("monthlyList");
  const { selectedStore } = useStore();
  const { state, reload, saveLines } = useMonthlyList(selectedStore?.id);
  const list = state.kind === "ready" ? state.list : null;
  const save = useMemo(() => (lines: ListLine[]) => (list ? saveLines(list.id, () => lines) : Promise.resolve(false)), [list?.id, saveLines]);
  if (state.kind === "loading") return <Loader style={styles.loader} />;
  if (!list || !selectedStore) {
    return (
      <View style={styles.failed}>
        <Text style={styles.failedText}>{t.loadFailed}</Text>
        <TouchableOpacity style={styles.retry} onPress={reload} accessibilityRole="button"><Text style={styles.retryText}>{t.retry}</Text></TouchableOpacity>
      </View>
    );
  }
  const store = { id: selectedStore.id, name: selectedStore.name, translations: selectedStore.translations };
  return <ListBasketScope list={list} store={store} save={save}>{children}</ListBasketScope>;
}

const styles = StyleSheet.create({
  loader: { marginTop: 48 },
  failed: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 16 },
  failedText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  retry: { height: 44, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, justifyContent: "center" },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
