import { Text, View, StyleSheet, type TextStyle } from "react-native";
import { colors, fonts } from "../constants/theme";
import { unitPriceLabel } from "../lib/unit-price";
import type { Variant } from "../lib/types";

// Top-left of the product photo; the heart owns top-right and the veg mark bottom-left
export function BestsellerBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Bestseller">
      <Text style={styles.badgeText}>BESTSELLER</Text>
    </View>
  );
}

// Paid placements are marked plainly but quietly; sits in the card's text block
export function AdBadge() {
  return (
    <View style={styles.ad} accessibilityLabel="Advertisement">
      <Text style={styles.adText}>Ad</Text>
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
  unitPrice: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textSecondary, marginTop: 1 },
});
