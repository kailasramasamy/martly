import { View, Text, StyleSheet } from "react-native";
import { ProductList } from "../ProductList";
import type { StoreProduct } from "../../lib/types";
import { colors, spacing } from "../../constants/theme";

/** A titled row of products under the cart's items; renders nothing when there are none */
export function SuggestionRail({ title, subtitle, products }: { title: string; subtitle?: string; products: StoreProduct[] }) {
  if (products.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.rail}>
        <ProductList products={products} layout="rail" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sm, paddingBottom: spacing.sm },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  // The list is padded already; the rail runs edge to edge like on Home
  rail: { marginTop: spacing.sm, marginHorizontal: -spacing.md },
});
