import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";

const SHORTCUTS: { label: string; icon: keyof typeof Ionicons.glyphMap; href: string }[] = [
  { label: "Products", icon: "cube-outline", href: "/manage/products" },
  { label: "Categories", icon: "grid-outline", href: "/manage/categories" },
  { label: "Brands", icon: "pricetag-outline", href: "/manage/brands" },
  { label: "Collections", icon: "albums-outline", href: "/manage/collections" },
];

/** Entry to the shared product catalog — kept visually separate from this store's listings below */
export function CatalogShortcuts() {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Product catalog</Text>
      <Text style={styles.hint}>Names, images and variants shared by all stores</Text>
      <View style={styles.grid}>
        {SHORTCUTS.map((s) => (
          <TouchableOpacity key={s.href} style={styles.tile} onPress={() => router.push(s.href)} accessibilityRole="button" activeOpacity={0.75}>
            <Ionicons name={s.icon} size={17} color={colors.primary} />
            <Text style={styles.label}>{s.label}</Text>
            <Ionicons name="chevron-forward" size={14} color={manage.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 14 },
  title: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase" },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 3, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    flexBasis: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 12,
    borderRadius: radius.md, backgroundColor: manage.tint,
  },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
});
