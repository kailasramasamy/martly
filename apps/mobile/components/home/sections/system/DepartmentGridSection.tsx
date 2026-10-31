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
const GAP = 12;
const INNER_WIDTH = SCREEN_WIDTH - H_PADDING * 2 - 32;
const tileSize = (perRow: number) => Math.floor((INNER_WIDTH - GAP * (perRow - 1)) / perRow);

/** Rows of 4, led by rows of 3 bigger tiles so the last row is never short */
function gridRows<T>(items: T[]): T[][] {
  const leadRows = items.length >= 9 ? (4 - (items.length % 4)) % 4 : 0;
  const rows: T[][] = [];
  for (let i = 0; i < items.length; ) {
    const perRow = rows.length < leadRows ? 3 : 4;
    rows.push(items.slice(i, i + perRow));
    i += perRow;
  }
  return rows;
}

// The bestseller cards' neutral grey with a touch of teal, so Home's first blocks read as one set
const TILE_TINT = "#e8f1f1";

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
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t.shopByCategory}</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/categories")} style={styles.link}>
          <Text style={styles.linkText}>{c.seeAll}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {gridRows(departments).map((row) => (
          <View key={row[0].id} style={styles.row}>
            {row.map((dept) => (
              <CategoryTile
                key={dept.id}
                title={getLocalizedName(dept)}
                imageUrl={dept.imageUrl}
                fallbackIcon={getCategoryIcon(dept.name)}
                size={tileSize(departments.length >= 9 ? row.length : 4)}
                onPress={() => openDepartment(dept.id)}
                tint={TILE_TINT}
              />
            ))}
          </View>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  title: { flexShrink: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  link: { flexDirection: "row", alignItems: "center", gap: 2 },
  linkText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  grid: { rowGap: 14 },
  row: { flexDirection: "row", columnGap: GAP },
});
