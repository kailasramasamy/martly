import { FlatList, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";

// Refinements of the current search ("→ Surf Excel detergent"), shown under the filters like Instamart
export function RelatedSearches({ items, onSelect }: { items: string[]; onSelect: (text: string) => void }) {
  if (items.length === 0) return null;
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(t) => t}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.list}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.chip} onPress={() => onSelect(item)} accessibilityRole="button" accessibilityLabel={`Search ${item}`}>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          <Text style={styles.label} numberOfLines={1}>{item}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 12,
    borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
