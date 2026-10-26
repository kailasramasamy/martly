import { LayoutAnimation, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { SuggestionRail } from "../cart/SuggestionRail";
import { useCartRemoval } from "../cart/use-cart-removal";
import { useCartReview } from "../cart/use-cart-review";
import { BagHero } from "./BagHero";
import { BagLine } from "./BagLine";
import { useCountUp } from "./motion";
import type { StoreWalk } from "./use-store-walk";

type WalkLine = StoreWalk["added"][number];
type Aisle = { key: string; title: string; data: WalkLine[] };

// The added lines under the aisle each went in from, aisles in the order the walk reached them
function useAisles(walk: StoreWalk): Aisle[] {
  const { getLocalizedName } = useLanguage();
  const aisles = new Map<string, Aisle>();
  for (const line of walk.added) {
    const key = line.from?.categoryId ?? "";
    const aisle = aisles.get(key) ?? { key, title: line.from ? getLocalizedName(line.from) : "", data: [] };
    aisle.data.push(line);
    aisles.set(key, aisle);
  }
  return [...aisles.values()];
}

// A quantity of 0 takes the line out, with Undo on the toast; the list closes up around a row that leaves
function useQuantity() {
  const { items, updateQuantity } = useCart();
  const removal = useCartRemoval();
  return (storeProductId: string, quantity: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (quantity > 0) updateQuantity(storeProductId, quantity);
    else removal.removeAt(items.findIndex((i) => i.storeProductId === storeProductId));
  };
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

function Header({ walk, minutes }: { walk: StoreWalk; minutes: number }) {
  const t = useStrings("storeWalk");
  const { totalAmount } = useCart();
  const total = useCountUp(Math.round(totalAmount));
  const count = walk.added.reduce((n, l) => n + l.added, 0);
  return (
    <View>
      <View style={styles.hero}>
        <BagHero items={walk.added.map((l) => l.item)} />
        <View style={styles.heroText}>
          <Text style={styles.title}>{t.walkDone}</Text>
          <Text style={styles.subtitle}>{t.walkDoneStats(walk.walked.size, minutes)}</Text>
          <View style={styles.totals}>
            <Text style={styles.total}>{"₹"}{total.toLocaleString("en-IN")}</Text>
            <Text style={styles.totalLabel}>{t.bagLabel}</Text>
          </View>
          <Text style={styles.count}>{count} {t.itemsLabel}</Text>
        </View>
      </View>
      <Text style={styles.section}>{walk.added.length > 0 ? t.addedOnWalk : t.nothingAdded}</Text>
    </View>
  );
}

interface Props { walk: StoreWalk; minutes: number; onBack: () => void }

/** The walk's end: the bag it filled, its lines by aisle, the cart's suggestions, then back to the walk or the cart */
export function WalkSummary({ walk, minutes, onBack }: Props) {
  const t = useStrings("storeWalk");
  const insets = useSafeAreaInsets();
  const { totalAmount } = useCart();
  const aisles = useAisles(walk);
  const setQuantity = useQuantity();
  return (
    <View style={styles.container}>
      <SectionList
        sections={aisles} keyExtractor={(l) => l.item.storeProductId} contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false} ListHeaderComponent={<Header walk={walk} minutes={minutes} />}
        renderSectionHeader={({ section }) => (section.title ? (
          <View style={styles.aisle}>
            <Text style={styles.aisleName} numberOfLines={1}>{section.title}</Text>
            <Text style={styles.aisleCount}>{section.data.length}</Text>
          </View>
        ) : null)}
        renderItem={({ item, index, section }) => (
          <BagLine
            item={item.item} first={index === 0} last={index === section.data.length - 1}
            onQuantity={(q) => setQuantity(item.item.storeProductId, q)}
          />
        )}
        ListFooterComponent={<Suggestions />}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.back} onPress={onBack} accessibilityRole="button">
          <Ionicons name="walk-outline" size={18} color={colors.primary} />
          <Text style={styles.backText} numberOfLines={2}>{t.backToWalk}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cart} onPress={() => router.replace("/(tabs)/cart")} accessibilityRole="button">
          <Ionicons name="bag-handle" size={18} color="#ffffff" />
          <Text style={styles.cartText} numberOfLines={2}>{t.goToCart(Math.round(totalAmount).toLocaleString("en-IN"))}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 24 },
  // Kraft-paper warm, to sit with the bag
  hero: {
    flexDirection: "row", alignItems: "flex-end", gap: 12, paddingTop: 8, paddingHorizontal: 14, paddingBottom: 14,
    borderRadius: 20, backgroundColor: "#fbf6ee", borderWidth: 1, borderColor: "#efe3d0",
  },
  heroText: { flex: 1, gap: 2, paddingBottom: 4 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 30, color: colors.text },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, color: "#8a6a45" },
  totals: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: 6, marginTop: 10 },
  total: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.primary },
  totalLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  count: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  section: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, marginTop: 20, marginBottom: 2 },
  aisle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 6 },
  aisleName: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary },
  aisleCount: {
    minWidth: 20, paddingHorizontal: 6, borderRadius: 10, overflow: "hidden", backgroundColor: "#ccfbf1", textAlign: "center",
    fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 20, color: colors.primary,
  },
  // The cart's rails run edge to edge, as in the cart
  suggestions: { marginHorizontal: -16, marginTop: 16 },
  footer: {
    flexDirection: "row", gap: 10, paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  back: {
    flex: 1, height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8,
  },
  backText: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 14, color: colors.primary, textAlign: "center" },
  cart: { flex: 1.4, paddingHorizontal: 10, height: 52, borderRadius: 12, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  cartText: { flexShrink: 1, fontFamily: fonts.extrabold, fontSize: 15, color: "#ffffff", textAlign: "center" },
});
