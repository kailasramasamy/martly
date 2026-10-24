import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { BuyGetDealsSection as BuyGetDeals } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useStrings } from "../../../lib/i18n/use-strings";
import type { StoreProduct } from "../../../lib/types";
import { ProductList } from "../../ProductList";
import { useSectionText } from "./context";

const H_PADDING = 16;
const RIBBON = 6;
const BADGE = 48;
const BAND_PADDING = 14;
// The shelf under the gift band: the brand teal washed right down
export const BUY_GET_SHELF = "#effaf8";

/** A gift band (teal, tied with an amber ribbon) over the store's buy X get Y offers; "View all" opens the full list */
export const BuyGetDealsSection = memo(function BuyGetDealsSection({ section }: { section: BuyGetDeals<StoreProduct> }) {
  const t = useStrings("home");
  const c = useStrings("common");
  const text = useSectionText(section);
  const openAll = () => router.push("/buy-get");
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.band} onPress={openAll} activeOpacity={0.9} accessibilityRole="link">
        <View style={styles.ribbonDown} />
        <View style={styles.ribbonAcross} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>1+1</Text>
        </View>
        <View style={styles.headText} accessibilityRole="header">
          <Text style={styles.title} numberOfLines={1}>{text.title || t.buyGetTitle}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{text.subtitle || t.buyGetSubtitle(section.total)}</Text>
        </View>
        <View style={styles.link}>
          <Text style={styles.linkText}>{c.viewAll}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </View>
      </TouchableOpacity>
      <View style={styles.shelf}>
        <ProductList products={section.products} layout="rail" />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24, marginHorizontal: H_PADDING, borderRadius: 20, overflow: "hidden", backgroundColor: BUY_GET_SHELF },
  band: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72,
    paddingHorizontal: BAND_PADDING, paddingVertical: 14, backgroundColor: colors.primaryDark, overflow: "hidden",
  },
  // The ribbon a gift is tied with: down behind the badge, which sits on it like the bow, and faintly across the middle
  ribbonDown: {
    position: "absolute", top: 0, bottom: 0, left: BAND_PADDING + BADGE / 2 - RIBBON / 2, width: RIBBON,
    backgroundColor: colors.accent, opacity: 0.5,
  },
  ribbonAcross: { position: "absolute", left: 0, right: 0, top: "50%", height: RIBBON, marginTop: -RIBBON / 2, backgroundColor: colors.accent, opacity: 0.18 },
  badge: {
    width: BADGE, height: BADGE, borderRadius: BADGE / 2, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fde68a", transform: [{ rotate: "-8deg" }],
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.accentText, letterSpacing: -0.5 },
  headText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: "#ffffff", letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 12, color: "#99f6e4", marginTop: 2 },
  link: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
  shelf: { paddingTop: 14, paddingBottom: 16 },
});
