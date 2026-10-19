import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { colors } from "../../../../constants/theme";
import type { StoreProduct } from "../../../../lib/types";
import { ProductList } from "../../../ProductList";

const H_PADDING = 16;

/** Top priority for returning customers: what they order often */
export const BuyAgainSection = memo(function BuyAgainSection({ section }: { section: SystemSection }) {
  const products = section.data.products as StoreProduct[];
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.icon}>
            <Ionicons name="repeat" size={14} color="#fff" />
          </View>
          <View>
            <Text style={styles.title}>Buy Again</Text>
            <Text style={styles.subtitle}>Your frequently ordered items</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push("/smart-reorder")} style={styles.link}>
          <Text style={styles.linkText}>Smart reorder</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <ProductList products={products} layout="rail" />
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 16, backgroundColor: "#f0fdfa", paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#ccfbf1" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: H_PADDING, marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 12, color: "#64748b", marginTop: 1 },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 13, fontWeight: "600", color: colors.primary },
});
