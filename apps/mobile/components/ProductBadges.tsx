import { Text, View, StyleSheet, type TextStyle, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { unitPriceLabel } from "../lib/unit-price";
import { useStrings } from "../lib/i18n/use-strings";
import type { BrandPick } from "@martly/shared/constants";
import type { Variant } from "../lib/types";

// Top-left of the product photo; the heart owns top-right and the veg mark bottom-left
export function BestsellerBadge() {
  const t = useStrings("catalog");
  return (
    <View style={styles.badge} accessibilityLabel={t.bestseller}>
      <Text style={styles.badgeText}>{t.bestsellerBadge}</Text>
    </View>
  );
}

// Paid placements are marked plainly but quietly; sits in the card's text block
export function AdBadge({ style }: { style?: ViewStyle }) {
  const t = useStrings("catalog");
  return (
    <View style={[styles.ad, style]} accessibilityLabel={t.advertisement}>
      <Text style={styles.adText}>{t.ad}</Text>
    </View>
  );
}

// The store's own or featured brand, ranked ahead: labelled like an ad, in teal so it reads as the store's choice
export function BrandPickBadge({ pick }: { pick: BrandPick }) {
  const t = useStrings("catalog");
  return (
    <View style={styles.pick}>
      <Text style={styles.pickText}>{t.brandPick[pick]}</Text>
    </View>
  );
}

// The owner vouches for it: solid teal with a tick, a step above the brand labels; the product page says why
export function OwnerPickBadge() {
  const t = useStrings("storeVoice");
  return (
    <View style={styles.owner}>
      <Ionicons name="checkmark" size={10} color="#ffffff" />
      <Text style={styles.ownerText}>{t.ownersPick}</Text>
    </View>
  );
}

export function UnitPrice({ price, variant, style }: { price: number; variant: Variant; style?: TextStyle }) {
  const label = unitPriceLabel(price, variant);
  return label ? <Text style={[styles.unitPrice, style]} numberOfLines={1}>{label}</Text> : null;
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute", top: 0, left: 0, zIndex: 2,
    backgroundColor: colors.accent, borderTopLeftRadius: 10, borderBottomRightRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 9, letterSpacing: 0.5, color: colors.accentText },
  ad: { alignSelf: "flex-start", backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 3 },
  adText: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.3, color: colors.textSecondary },
  pick: { alignSelf: "flex-start", backgroundColor: "#ccfbf1", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 3 },
  owner: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 3 },
  ownerText: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.3, color: "#ffffff" },
  pickText: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.3, color: colors.primary },
  unitPrice: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary, marginTop: 1 },
});
