import { Animated, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useCart, type CartItem } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { SuggestionRail } from "../cart/SuggestionRail";
import { useCartReview } from "../cart/use-cart-review";
import { DoneMark } from "./NextDepartmentCard";
import { useCountUp, useEntrance } from "./motion";
import type { StoreWalk } from "./use-store-walk";

type Line = { item: CartItem; added: number; aisle: string };

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function LineRow({ line, i }: { line: Line; i: number }) {
  const { getLocalizedName } = useLanguage();
  const entrance = useEntrance(250 + Math.min(i, 8) * 60);
  const name = getLocalizedName({ name: line.item.productName, translations: line.item.translations });
  return (
    <Animated.View style={[styles.line, entrance]}>
      <Image source={{ uri: line.item.imageUrl ?? undefined }} style={styles.lineImage} />
      <View style={styles.lineText}>
        <Text style={styles.lineName} numberOfLines={1}>{line.added > 1 ? `${line.added} × ` : ""}{name}</Text>
        <Text style={styles.lineAisle} numberOfLines={1}>{line.aisle}</Text>
      </View>
      <Text style={styles.linePrice}>{"₹"}{Math.round(line.item.price * line.added).toLocaleString("en-IN")}</Text>
    </Animated.View>
  );
}

// Each added line with the aisle it came from (lines added from elsewhere, e.g. "See all", keep a blank aisle)
function useLines(walk: StoreWalk): Line[] {
  const { getLocalizedName } = useLanguage();
  const aisleOf = new Map<string, string>();
  for (const entry of walk.aisles.values()) {
    if (entry === "error") continue;
    for (const sp of [...entry.due, ...entry.popular]) aisleOf.set(sp.product.id, getLocalizedName(entry.category));
  }
  return walk.added.map((l) => ({ ...l, aisle: aisleOf.get(l.item.productId) ?? "" }));
}

// The cart's own nudges, as the cart shows them: usual items not in the bag, else what others buy with these
function Suggestions() {
  const tc = useStrings("cart");
  const review = useCartReview(null);
  return (
    <View style={styles.suggestions}>
      <SuggestionRail title={tc.forgotTitle} subtitle={tc.forgotSubtitle} products={review.forgotten} />
      {review.forgotten.length === 0 && <SuggestionRail title={tc.alsoBought} products={review.alsoBought} />}
    </View>
  );
}

interface Props { walk: StoreWalk; minutes: number; onBack: () => void }

/** The walk's end: what it added, the cart's suggestions, then back to the walk or on to the cart */
export function WalkSummary({ walk, minutes, onBack }: Props) {
  const t = useStrings("storeWalk");
  const insets = useSafeAreaInsets();
  const { totalAmount } = useCart();
  const lines = useLines(walk);
  const total = useCountUp(Math.round(totalAmount));
  const header = (
    <View style={styles.header}>
      <DoneMark />
      <Text style={styles.title}>{t.walkDone}</Text>
      <Text style={styles.subtitle}>{t.walkDoneStats(walk.walked.size, minutes)}</Text>
      <View style={styles.stats}>
        <Stat value={String(lines.reduce((n, l) => n + l.added, 0))} label={t.itemsLabel} />
        <Stat value={`₹${total.toLocaleString("en-IN")}`} label={t.bagLabel} />
      </View>
      <Text style={styles.section}>{lines.length > 0 ? t.addedOnWalk : t.nothingAdded}</Text>
    </View>
  );
  return (
    <View style={styles.container}>
      <FlatList
        data={lines} keyExtractor={(l) => l.item.storeProductId} contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => <LineRow line={item} i={index} />}
        ListFooterComponent={<Suggestions />}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button">
          <Ionicons name="walk-outline" size={18} color={colors.primary} />
          <Text style={styles.backText} numberOfLines={2}>{t.backToWalk}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cart} onPress={() => router.replace("/(tabs)/cart")} accessibilityRole="button">
          <Ionicons name="bag-handle" size={18} color="#ffffff" />
          <Text style={styles.cartText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t.goToCart(total.toLocaleString("en-IN"))}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, paddingBottom: 24 },
  header: { alignItems: "center", gap: 8, paddingTop: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  stats: { flexDirection: "row", gap: 8, alignSelf: "stretch", marginVertical: 6 },
  stat: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statValue: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  statLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  section: { alignSelf: "stretch", fontFamily: fonts.extrabold, fontSize: 15, color: colors.text, marginTop: 10, marginBottom: 4 },
  line: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingHorizontal: 12,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  lineImage: { width: 40, height: 40, resizeMode: "contain" },
  lineText: { flex: 1, gap: 1 },
  lineName: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  lineAisle: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary },
  linePrice: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  // The cart's rails run edge to edge, as in the cart
  suggestions: { marginHorizontal: -16, marginTop: 8 },
  footer: {
    flexDirection: "row", gap: 10, paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.background,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  back: {
    flex: 1, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8,
  },
  backText: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary, textAlign: "center" },
  cart: { flex: 1.4, paddingHorizontal: 10, height: 52, borderRadius: 12, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  cartText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff" },
});
