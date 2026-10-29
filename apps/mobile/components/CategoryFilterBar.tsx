import type { ReactNode } from "react";
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../lib/language-context";
import { useStrings } from "../lib/i18n/use-strings";
import { colors } from "../constants/theme";

export type PriceSort = "price_asc" | "price_desc";

interface Pill {
  id: string;
  name: string;
  translations?: Record<string, { name?: string; description?: string }> | null;
}

interface CategoryFilterBarProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  pills: Pill[];
  activePill: string | null;
  onPillSelect: (id: string | null) => void;
  /** The Brands chip, first among the filter chips */
  brandChip?: ReactNode;
  onSale: boolean;
  onToggleSale: () => void;
  sortBy: PriceSort | null;
  onSortChange: (sort: PriceSort | null) => void;
}

function SortChip({ sort, active, onPress }: { sort: PriceSort; active: boolean; onPress: () => void }) {
  const t = useStrings("catalog");
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={sort === "price_asc" ? "arrow-up" : "arrow-down"} size={13} color={active ? "#fff" : "#64748b"} />
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.price}</Text>
    </TouchableOpacity>
  );
}

// Search box, subcategory pills and the brand / on-sale / price chips above a category's product grid
export function CategoryFilterBar(props: CategoryFilterBarProps) {
  const { getLocalizedName } = useLanguage();
  const t = useStrings("catalog");
  const { searchQuery, onSearchChange, pills, activePill, onPillSelect, sortBy, onSortChange } = props;
  const toggleSort = (sort: PriceSort) => onSortChange(sortBy === sort ? null : sort);

  return (
    <>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t.searchProducts}
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => onSearchChange("")} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {pills.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.bar}>
          {[{ id: null, label: t.all }, ...pills.map((p) => ({ id: p.id, label: getLocalizedName(p) }))].map(({ id, label }) => {
            const isActive = activePill === id;
            return (
              <TouchableOpacity
                key={id ?? "all"}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => onPillSelect(id && isActive ? null : id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.bar}>
        {props.brandChip}
        <TouchableOpacity style={[styles.chip, props.onSale && styles.chipActive]} onPress={props.onToggleSale} activeOpacity={0.7}>
          <Ionicons name="pricetag" size={13} color={props.onSale ? "#fff" : "#64748b"} />
          <Text style={[styles.chipText, props.onSale && styles.chipTextActive]}>{t.onSale}</Text>
        </TouchableOpacity>
        <SortChip sort="price_asc" active={sortBy === "price_asc"} onPress={() => toggleSort("price_asc")} />
        <SortChip sort="price_desc" active={sortBy === "price_desc"} onPress={() => toggleSort("price_desc")} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, letterSpacing: 0, color: colors.text, paddingVertical: 0 },
  pillScroll: { minHeight: 44, flexGrow: 0 },
  chipScroll: { minHeight: 40, flexGrow: 0 },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  pillActive: { backgroundColor: colors.primary },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  pillTextActive: { color: "#fff" },
  chip: {
    flexDirection: "row",
    height: 30,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTextActive: { color: "#fff" },
});
