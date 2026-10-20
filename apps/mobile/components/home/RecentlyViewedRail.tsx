import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { clearRecentlyViewed, useRecentlyViewed } from "../../lib/recently-viewed";
import { ProductList } from "../ProductList";

/** Products the shopper opened lately, so they can pick up where they left off; hidden until there are any */
export function RecentlyViewedRail({ storeId }: { storeId: string }) {
  const t = useStrings("home");
  const products = useRecentlyViewed(storeId);
  if (products.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.icon}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.title}>{t.recentlyViewed}</Text>
            <Text style={styles.subtitle}>{t.recentlySubtitle}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearRecentlyViewed} style={styles.clear} accessibilityRole="button" accessibilityLabel={t.clearRecentlyViewed}>
          <Text style={styles.clearText}>{t.clear}</Text>
        </TouchableOpacity>
      </View>
      <ProductList products={products} layout="rail" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#ccfbf1", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  clear: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  clearText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
});
