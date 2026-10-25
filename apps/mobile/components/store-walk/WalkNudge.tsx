import { useCallback, useEffect, useState } from "react";
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { api } from "../../lib/api";
import { toCartItem, useCart } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useMembership } from "../../lib/membership-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { WalkRoute } from "../../lib/types";
import { walkMinutes, walkSession } from "../../lib/walk-session";
import { useEntrance } from "./motion";

type Variant = "cart" | "checkout";
// A walk through one unseen aisle isn't worth offering
const MIN_OPEN_AISLES = 2;
const CHIPS = 4;
const CHECKOUT_DUE = 3;

// The walk route for the cart as it is, re-asked when its lines change; nothing once walked or hidden this session
function useWalkNudge(variant: Variant) {
  const { storeId, items } = useCart();
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const isHidden = () => walkSession.walked || walkSession.dismissed.has(variant);
  const [hidden, setHidden] = useState(isHidden);
  useFocusEffect(useCallback(() => setHidden(isHidden()), [variant]));
  const key = items.map((i) => i.storeProductId).sort().join(",");
  useEffect(() => {
    if (hidden || !storeId || !key) return;
    let live = true;
    const timer = setTimeout(() => {
      api.post<WalkRoute>(`/api/v1/store-walk/${storeId}/route`, { cartStoreProductIds: key.split(",") })
        .then((res) => live && setRoute(res.data))
        .catch(() => live && setRoute(null));
    }, 500);
    return () => { live = false; clearTimeout(timer); };
  }, [hidden, storeId, key]);
  const dismiss = () => { walkSession.dismissed.add(variant); setHidden(true); };
  return { route: hidden ? null : route, dismiss };
}

const openWalk = (from: Variant, departmentId: string) => router.push({ pathname: "/store-walk", params: { from, departmentId } });

function AisleChip({ label, due, i }: { label: string; due: boolean; i: number }) {
  const entrance = useEntrance(500 + i * 70, 6);
  return <Animated.View style={[styles.chip, due && styles.chipDue, entrance]}><Text style={[styles.chipText, due && styles.chipTextDue]}>{label}</Text></Animated.View>;
}

/** In the cart: the department's aisles the cart has nothing from, and a walk through just those */
export function CartWalkNudge() {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const { itemCount } = useCart();
  const { route, dismiss } = useWalkNudge("cart");
  const entrance = useEntrance(300, 20);
  if (!route || route.uncovered < MIN_OPEN_AISLES) return null;
  const department = route.departments.find((d) => d.id === route.departmentId)!;
  const open = route.stops.filter((s) => !s.inCart).sort((a, b) => b.dueCount - a.dueCount);
  const shown = open.slice(0, CHIPS);
  return (
    <Animated.View style={[styles.card, entrance]}>
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="walk-outline" size={22} color={colors.primary} /></View>
        <View style={styles.headText}>
          <Text style={styles.title}>{t.missedAnything}</Text>
          <Text style={styles.body}>
            {t.cartNudge(itemCount, route.cartAisles, route.uncovered, getLocalizedName(department))}
            {route.uncoveredDue > 0 ? t.cartNudgeDue(route.uncoveredDue) : ""}
          </Text>
        </View>
        <TouchableOpacity style={styles.close} onPress={dismiss} accessibilityRole="button" accessibilityLabel={t.hideNudge}>
          <Ionicons name="close" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>
      <View style={styles.chips}>
        {shown.map((s, i) => <AisleChip key={s.categoryId} label={getLocalizedName(s)} due={s.dueCount > 0} i={i} />)}
        {open.length > shown.length && <AisleChip label={`+${open.length - shown.length}`} due={false} i={shown.length} />}
      </View>
      <TouchableOpacity style={styles.walk} onPress={() => openWalk("cart", route.departmentId)} accessibilityRole="button">
        <Text style={styles.walkText}>{t.walkTheAisles(walkMinutes(route.uncovered))}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Above Place order: usual items not in the bag, added in one tap, or a quick walk. Never in the way of ordering */
export function CheckoutWalkNudge() {
  const t = useStrings("storeWalk");
  const { store, addItems } = useCart();
  const { isMember } = useMembership();
  const { route } = useWalkNudge("checkout");
  const [added, setAdded] = useState(0);
  const entrance = useEntrance(600, 24);
  const missing = (route?.due ?? []).slice(0, CHECKOUT_DUE);
  if (added > 0) {
    return (
      <View style={[styles.row, styles.rowDone]}>
        <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
        <Text style={styles.doneText}>{t.addedMissing(added)}</Text>
      </View>
    );
  }
  if (!route || !store || missing.length === 0) return null;
  const lines = missing.map((sp) => toCartItem(sp, 1, isMember));
  const total = Math.round(lines.reduce((sum, l) => sum + l.price, 0));
  return (
    <Animated.View style={[styles.row, entrance]}>
      <View style={styles.thumbs}>
        {missing.slice(0, 2).map((sp, i) => (
          <Image key={sp.id} source={{ uri: sp.product.imageUrl ?? undefined }} style={[styles.thumb, i > 0 && styles.thumbStacked]} />
        ))}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{t.checkoutMissing(missing.length)}</Text>
        <TouchableOpacity onPress={() => openWalk("checkout", route.departmentId)} accessibilityRole="link" hitSlop={{ top: 8, bottom: 8 }}>
          <Text style={styles.rowLink}>{t.quickWalk}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.addAll} accessibilityRole="button"
        onPress={() => { addItems(store, lines); setAdded(lines.length); }}
      >
        <Text style={styles.addAllText}>{t.addMissing(lines.length, total.toLocaleString("en-IN"))}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 16, borderWidth: 1.5, borderColor: "#99f6e4", backgroundColor: colors.background, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  headText: { flex: 1, gap: 3 },
  title: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "#475569" },
  close: { width: 44, height: 44, marginTop: -10, marginRight: -10, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: "#f1f5f9" },
  chipDue: { backgroundColor: "#fef3c7" },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: "#334155" },
  chipTextDue: { color: "#78350f" },
  walk: { height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  walkText: { fontFamily: fonts.extrabold, fontSize: 15, color: "#ffffff" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fffbeb", borderTopWidth: 1, borderTopColor: "#fde68a",
  },
  rowDone: { backgroundColor: "#f0fdf4", borderTopColor: "#bbf7d0" },
  doneText: { fontFamily: fonts.extrabold, fontSize: 13, color: "#166534" },
  thumbs: { flexDirection: "row" },
  thumb: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: "#fde68a", backgroundColor: "#ffffff" },
  thumbStacked: { marginLeft: -8 },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontFamily: fonts.extrabold, fontSize: 13, color: "#78350f" },
  rowLink: { fontFamily: fonts.bold, fontSize: 12, color: "#92400e", textDecorationLine: "underline" },
  addAll: { height: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#ffffff", justifyContent: "center" },
  addAllText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary },
});
