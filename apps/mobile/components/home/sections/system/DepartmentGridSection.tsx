import { memo } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { colors } from "../../../../constants/theme";
import { getCategoryIcon } from "../../../../constants/category-icons";
import { useLanguage } from "../../../../lib/language-context";
import { useStrings } from "../../../../lib/i18n/use-strings";
import type { DepartmentNode } from "../../../../lib/types";
import { CategoryTile } from "../../../CategoryTile";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
// 4 tiles per row inside the padded section card
const TILE_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - 32 - 12 * 3) / 4);

const openDepartment = (id: string) => router.push({ pathname: "/category/[id]", params: { id } });

/** "Shop by Category": every department as a tile */
export const DepartmentGridSection = memo(function DepartmentGridSection({ section }: { section: SystemSection }) {
  const departments = section.data.departments as DepartmentNode[];
  const { getLocalizedName } = useLanguage();
  const t = useStrings("home");
  const c = useStrings("common");
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.shopByCategory}</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/categories")} style={styles.link}>
          <Text style={styles.linkText}>{c.seeAll}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {departments.map((dept) => (
          <CategoryTile
            key={dept.id}
            title={getLocalizedName(dept)}
            imageUrl={dept.imageUrl}
            fallbackIcon={getCategoryIcon(dept.name)}
            size={TILE_SIZE}
            onPress={() => openDepartment(dept.id)}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginTop: 20, marginHorizontal: H_PADDING, backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
});
