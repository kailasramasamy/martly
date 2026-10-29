import { useEffect, useState } from "react";
import { Image, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MonthlyListItemOptions } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { api, ApiError } from "../../lib/api";
import { useLanguage } from "../../lib/language-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { MonthlyListLine, StoreProduct } from "../../lib/types";
import { Loader } from "../Loader";
import { BottomSheet } from "../search/BottomSheet";

type Options = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; options: MonthlyListItemOptions<StoreProduct> };

// Display units the API sends, as [packs of this unit per kg or litre, the unit priced]
const PER: Record<string, [number, string]> = { g: [1000, "kg"], kg: [1, "kg"], ml: [1000, "L"], L: [1, "L"] };

/** "₹62/kg", to compare packs of different sizes; null for counted items */
export function perUnit(sp: StoreProduct, price: number) {
  const [per, unit] = PER[sp.variant.unitType] ?? [];
  const value = Number(sp.variant.unitValue);
  return per && value > 0 ? `₹${Math.round((price / value) * per)}/${unit}` : null;
}

function useOptions(listId: string, itemId: string | undefined) {
  const [state, setState] = useState<Options>({ kind: "loading" });
  useEffect(() => {
    if (!itemId) return;
    let live = true;
    setState({ kind: "loading" });
    api.get<MonthlyListItemOptions<StoreProduct>>(`/api/v1/monthly-list/${listId}/items/${itemId}/options`)
      .then((res) => live && setState({ kind: "ready", options: res.data }))
      .catch((err) => {
        if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
        if (live) setState({ kind: "failed" });
      });
    return () => { live = false; };
  }, [listId, itemId]);
  return state;
}

function Option({ sp, brand, onPick }: { sp: StoreProduct; brand: boolean; onPick: (sp: StoreProduct) => void }) {
  const { getLocalizedName } = useLanguage();
  const { isMember } = useMembership();
  const price = Math.round(getBestPrice(sp, isMember));
  const unit = perUnit(sp, price);
  const detail = brand ? [sp.variant.name, unit].filter(Boolean).join(" · ") : unit;
  const image = sp.product.imageUrl ?? sp.variant.imageUrl;
  return (
    <TouchableOpacity style={styles.option} onPress={() => onPick(sp)} accessibilityRole="button">
      <View style={styles.thumb}>{image && <Image source={{ uri: image }} style={styles.thumbImg} />}</View>
      <View style={styles.optionInfo}>
        <Text style={styles.optionName} numberOfLines={2}>{brand ? getLocalizedName(sp.product) : sp.variant.name}</Text>
        {detail && <Text style={styles.optionSize}>{detail}</Text>}
      </View>
      <Text style={styles.optionPrice}>{`₹${price.toLocaleString("en-IN")}`}</Text>
      <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
    </TouchableOpacity>
  );
}

interface Props {
  visible: boolean;
  listId: string;
  /** The line being changed; kept while the sheet slides away */
  item: MonthlyListLine | null;
  onPick: (itemId: string, sp: StoreProduct) => void;
  onRemove: (itemId: string) => void;
  onClose: () => void;
}

/** Another size of the same product, or another brand, for a line of the list; or take it off the list */
export function SwapSheet({ visible, listId, item, onPick, onRemove, onClose }: Props) {
  const t = useStrings("monthlyList");
  const { getLocalizedName } = useLanguage();
  const state = useOptions(listId, item?.id);
  const sections = state.kind === "ready" ? [
    { key: "sizes", title: t.otherSizes, brand: false, data: state.options.sizes },
    { key: "brands", title: t.otherBrands, brand: true, data: state.options.brands },
  ].filter((s) => s.data.length > 0) : [];
  const footer = item && (
    <TouchableOpacity style={styles.remove} onPress={() => onRemove(item.id)} accessibilityRole="button">
      <Ionicons name="trash-outline" size={18} color="#b91c1c" />
      <Text style={styles.removeText}>{t.removeFromList}</Text>
    </TouchableOpacity>
  );
  return (
    <BottomSheet visible={visible} title={t.swapTitle} onClose={onClose} footer={footer} flush>
      {item && (
        <View style={styles.current}>
          <Text style={styles.currentTag}>{t.onYourList}</Text>
          <Text style={styles.currentName} numberOfLines={2}>{`${getLocalizedName(item)} · ${item.variantName}`}</Text>
        </View>
      )}
      {state.kind === "loading" && <Loader style={styles.status} />}
      {state.kind === "failed" && <Text style={styles.statusText}>{t.loadFailed}</Text>}
      {state.kind === "ready" && sections.length === 0 && <Text style={styles.statusText}>{t.noOptions}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(sp) => sp.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item: sp, section }) => <Option sp={sp} brand={section.brand} onPick={(picked) => item && onPick(item.id, picked)} />}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  current: { marginHorizontal: 16, marginBottom: 4, padding: 12, borderRadius: 12, backgroundColor: "#f0fdfa", gap: 2 },
  currentTag: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: colors.primary },
  currentName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  status: { marginVertical: 32 },
  statusText: { marginVertical: 32, marginHorizontal: 24, fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  section: { marginTop: 16, marginBottom: 4, paddingHorizontal: 16, fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: colors.textSecondary },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 42, height: 42, resizeMode: "contain", mixBlendMode: "multiply" },
  optionInfo: { flex: 1, minWidth: 0, gap: 2 },
  optionName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.text },
  optionSize: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  optionPrice: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text, fontVariant: ["tabular-nums"] },
  remove: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, marginHorizontal: 16, marginTop: 8, borderRadius: 12, borderWidth: 1.5, borderColor: "#fecaca" },
  removeText: { fontFamily: fonts.extrabold, fontSize: 14, color: "#b91c1c" },
});
