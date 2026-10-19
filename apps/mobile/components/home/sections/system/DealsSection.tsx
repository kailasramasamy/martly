import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { colors } from "../../../../constants/theme";
import type { StoreProduct } from "../../../../lib/types";
import { ProductList } from "../../../ProductList";

const H_PADDING = 16;

export const DealsSection = memo(function DealsSection({ section }: { section: SystemSection }) {
  const products = section.data.products as StoreProduct[];
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.icon}>
            <Ionicons name="flash" size={14} color="#fff" />
          </View>
          <Text style={styles.title}>Deals of the Day</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/search", params: { hasDiscount: "true" } } as never)}
          style={styles.link}
        >
          <Text style={styles.linkText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color="#92400e" />
        </TouchableOpacity>
      </View>
      <ProductList products={products} layout="rail" />
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24, backgroundColor: "#fffbeb", paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#fef3c7" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: H_PADDING, marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#f59e0b", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 13, fontWeight: "600", color: "#92400e" },
});
