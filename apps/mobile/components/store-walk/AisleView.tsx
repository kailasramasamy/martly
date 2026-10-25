import { useEffect, useRef, useState, type ReactElement } from "react";
import { Animated, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Loader } from "../Loader";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { api } from "../../lib/api";
import { useLanguage } from "../../lib/language-context";
import { useStore } from "../../lib/store-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct, WalkAisle } from "../../lib/types";
import { ProductList } from "../ProductList";
import { BrandFilterRow } from "../search/BrandFilterRow";
import { AisleSign } from "./AisleSign";
import { AisleWall, type NearAisle } from "./AisleWall";
import { EndCap } from "./EndCap";
import { Shelf, useShelves } from "./ShelfProducts";
import { SubcategoryRail } from "./SubcategoryRail";
import { useReduceMotion } from "../../lib/use-reduce-motion";

type Stop = { categoryId: string; name: string; translations: Record<string, { name?: string }> | null; imageUrl: string | null };

// The products on show: the aisle's best sellers, or one subcategory's and/or one brand's once the shopper picks them.
// Picking a subcategory clears the brand, as the brands on offer change with it
function useShelf(aisle: WalkAisle | "error" | undefined, categoryId: string) {
  const { selectedStore } = useStore();
  const [picked, setPicked] = useState<{ subcategoryId: string | null; brandId: string | null }>({ subcategoryId: null, brandId: null });
  // The last narrowed answer, kept while the next loads so the brand row doesn't jump
  const [narrowed, setNarrowed] = useState<{ key: string; aisle: WalkAisle } | null>(null);
  const filtered = !!(picked.subcategoryId || picked.brandId);
  const key = `${picked.subcategoryId}|${picked.brandId}`;
  useEffect(() => {
    if (!filtered || !selectedStore) return;
    const query = new URLSearchParams();
    if (picked.subcategoryId) query.set("subcategoryId", picked.subcategoryId);
    if (picked.brandId) query.set("brandId", picked.brandId);
    let live = true;
    api.get<WalkAisle>(`/api/v1/store-walk/${selectedStore.id}/aisles/${categoryId}?${query}`)
      .then((res) => live && setNarrowed({ key, aisle: res.data }))
      .catch(() => live && setPicked({ subcategoryId: null, brandId: null }));
    return () => { live = false; };
  }, [picked, key, filtered, categoryId, selectedStore]);
  const whole = aisle && aisle !== "error" ? aisle : null;
  const ready = narrowed?.key === key ? narrowed.aisle : null;
  // The brand row follows the picked subcategory
  const brands = (picked.subcategoryId ? narrowed?.aisle.brands : whole?.brands) ?? whole?.brands ?? [];
  return {
    ...picked, brands,
    pickSubcategory: (subcategoryId: string | null) => setPicked({ subcategoryId, brandId: null }),
    pickBrand: (brandId: string | null) => setPicked((p) => ({ ...p, brandId })),
    products: filtered ? ready?.popular ?? null : whole?.popular ?? [],
    loading: filtered && ready === null,
  };
}

// One amber glow round the due block, twice, so the shopper's usual item is the first thing they see
function DueBlock({ products }: { products: StoreProduct[] }) {
  const t = useStrings("storeWalk");
  const reduce = useReduceMotion();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const pulse = Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 520, useNativeDriver: true }),
    ]);
    Animated.sequence([Animated.delay(650), pulse, pulse]).start();
  }, [glow, reduce]);
  return (
    <View style={styles.due}>
      <Animated.View pointerEvents="none" style={[styles.dueGlow, { opacity: glow }]} />
      <View style={styles.dueHeader}>
        <Ionicons name="time-outline" size={16} color="#b45309" />
        <Text style={styles.dueTitle}>{t.runningLow}</Text>
        <Text style={styles.dueHint} numberOfLines={1}>{t.runningLowHint}</Text>
      </View>
      <ProductList products={products} layout="rail" />
    </View>
  );
}

// To the full aisle, or the picked subcategory (the category page opens either)
function SeeAll({ categoryId, stocked }: { categoryId: string; stocked: number }) {
  const t = useStrings("storeWalk");
  return (
    <TouchableOpacity
      style={styles.seeAll} activeOpacity={0.8} accessibilityRole="button"
      onPress={() => router.push({ pathname: "/category/[id]", params: { id: categoryId } })}
    >
      <Text style={styles.seeAllText}>{t.seeAll(stocked)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
    </TouchableOpacity>
  );
}

interface Props {
  stop: Stop;
  aisle: WalkAisle | "error" | undefined;
  onRetry: () => void;
  /** The aisles either side, hung grey beside the sign */
  prev: NearAisle | null;
  next: NearAisle | null;
  /** How far the aisle has slid sideways, for the wall photo's depth */
  slide: Animated.Value;
  /** The department's aisle photo for the wall */
  wallPhoto: string | null;
}

/** One aisle: its hanging sign (the aisles either side grey beside it), the shopper's due items, then its shelves */
export function AisleView({ stop, aisle, onRetry, prev, next, slide, wallPhoto }: Props) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const shelf = useShelf(aisle, stop.categoryId);
  const sign = (
    <AisleWall prev={prev} next={next} slide={slide} photo={wallPhoto}>
      <AisleSign key={stop.categoryId} name={getLocalizedName(stop)} imageUrl={stop.imageUrl} />
    </AisleWall>
  );

  if (aisle === "error") {
    return (
      <View style={styles.message}>
        {sign}
        <Text style={styles.messageText}>{t.aisleFailed}</Text>
        <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!aisle) return <View style={styles.message}>{sign}<Loader /></View>;
  return <AisleShelves aisle={aisle} stop={stop} sign={sign} shelf={shelf} />;
}

interface ShelvesProps { aisle: WalkAisle; stop: Stop; sign: ReactElement; shelf: ReturnType<typeof useShelf> }

function AisleShelves({ aisle, stop, sign, shelf }: ShelvesProps) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const { shelves, variantsOf } = useShelves(shelf.products ?? []);
  const picked = aisle.subcategories.find((sc) => sc.id === shelf.subcategoryId);
  return (
    <FlatList
      data={shelves} keyExtractor={(row) => row[0].product.id} contentContainerStyle={styles.grid}
      renderItem={({ item }) => <Shelf items={item} variantsOf={variantsOf} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {sign}
          {aisle.due.length > 0 && <DueBlock products={aisle.due} />}
          <SubcategoryRail subcategories={aisle.subcategories} allImage={stop.imageUrl} selected={shelf.subcategoryId} onSelect={shelf.pickSubcategory}
            raised={aisle.due.length === 0}
          />
          <View style={styles.brands}>
            <BrandFilterRow
              brands={shelf.brands} selectedIds={shelf.brandId ? [shelf.brandId] : []}
              onChange={(ids) => shelf.pickBrand(ids[0] ?? null)}
            />
          </View>
          <Text style={styles.popular}>{picked ? getLocalizedName(picked) : t.popular}</Text>
          {shelf.loading && <Loader />}
        </View>
      }
      ListFooterComponent={
        <View>
          <SeeAll categoryId={picked?.id ?? aisle.category.id} stocked={picked?.stocked ?? aisle.stocked} />
          <EndCap deals={aisle.endcap} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: 16, paddingBottom: 24 },
  header: { gap: 14, paddingBottom: 10 },
  // Edge to edge, like the tags above, so pills scroll in from the screen's sides rather than a padded edge
  brands: { marginHorizontal: -16 },
  due: { borderRadius: 12, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", paddingTop: 12, paddingBottom: 4, marginHorizontal: -4 },
  dueGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 12, borderWidth: 2, borderColor: colors.warning },
  dueHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, marginBottom: 4 },
  dueTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: "#78350f" },
  dueHint: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: "#92400e" },
  popular: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  seeAll: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 48, marginTop: 16,
    borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: "#5eead4", backgroundColor: "#f0fdfa",
  },
  seeAllText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primaryDark },
  // The wall keeps the full width while the aisle loads; only the spinner, message and retry are centred
  message: { flex: 1, gap: 16, paddingHorizontal: 16 },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  retry: { alignSelf: "center", height: 44, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, justifyContent: "center" },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
