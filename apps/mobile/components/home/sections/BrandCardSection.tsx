import { memo, useCallback } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BrandCardSection as BrandCard } from "@martly/shared/types";
import { HOME_BRAND_CARD_PRODUCTS } from "@martly/shared/constants";
import { COMPACT_GAP } from "../../CompactProductCard";
import { colors, fonts } from "../../../constants/theme";
import { useStrings } from "../../../lib/i18n/use-strings";
import type { StoreProduct } from "../../../lib/types";
import { useCompactCards } from "./CompactCards";
import { openSeeAll, useSectionText } from "./context";

const NEUTRAL_TINT = "#f1f5f9";
const LOGO = 56;
const ART = 96;
// Brand colours at or below this perceived brightness (0-255) take white text
const DARK_LUMINANCE = 150;

function isDark(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < DARK_LUMINANCE;
}

/**
 * A brand's block on its colour: logo, title and art above, three of its products below, and a pill into the brand's
 * page. The card is inset 8px (not the usual 16) so three compact cards fit across its padding.
 */
export const BrandCardSection = memo(function BrandCardSection({ section }: { section: BrandCard<StoreProduct> }) {
  const t = useStrings("home");
  const c = useStrings("common");
  const { title, subtitle } = useSectionText(section);
  const { brand, seeAll } = section;
  const tint = section.tint ?? NEUTRAL_TINT;
  const ink = isDark(tint) ? "#ffffff" : colors.text;
  const { products, renderCard } = useCompactCards(section.products);
  const onSeeAll = useCallback(() => { if (seeAll) openSeeAll(seeAll); }, [seeAll]);

  return (
    <View style={[styles.card, { backgroundColor: tint }]}>
      <View style={styles.top}>
        <View style={styles.logo}>
          {brand.logoUrl ? <Image source={{ uri: brand.logoUrl }} style={styles.logoImage} resizeMode="contain" /> : null}
        </View>
        <View style={styles.text} accessibilityRole="header">
          <Text style={[styles.title, { color: ink }]} numberOfLines={2}>{title ?? brand.name}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: ink }]} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {section.imageUrl ? <Image source={{ uri: section.imageUrl }} style={styles.art} resizeMode="contain" /> : null}
      </View>
      <View style={styles.products}>
        {products.slice(0, HOME_BRAND_CARD_PRODUCTS).map((sp) => <View key={sp.id}>{renderCard(sp)}</View>)}
      </View>
      {seeAll && (
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={t.seeAllOf(brand.name)}
          style={({ pressed }) => [styles.cta, { backgroundColor: ink }, pressed && styles.pressed]}
        >
          <Text style={[styles.ctaText, { color: tint }]}>{c.seeAll}</Text>
          <Ionicons name="arrow-forward" size={14} color={tint} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { marginTop: 24, marginHorizontal: 8, padding: 8, borderRadius: 20, overflow: "hidden" },
  top: { flexDirection: "row", alignItems: "center", gap: 12, padding: 8, minHeight: ART },
  logo: {
    width: LOGO, height: LOGO, borderRadius: LOGO / 2, padding: 8, backgroundColor: "#fff",
    shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  logoImage: { width: "100%", height: "100%" },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, opacity: 0.85 },
  art: { width: ART, height: ART },
  products: { flexDirection: "row", gap: COMPACT_GAP },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center",
    minHeight: 44, paddingHorizontal: 28, borderRadius: 22,
  },
  pressed: { opacity: 0.88 },
  ctaText: { fontFamily: fonts.extrabold, fontSize: 14 },
});
