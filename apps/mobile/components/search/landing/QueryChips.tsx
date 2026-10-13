import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../../constants/theme";

interface QueryChipsProps {
  queries: string[];
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (query: string) => void;
  onRemove?: (query: string) => void;
  horizontal?: boolean;
}

const capitalise = (q: string) => q.charAt(0).toUpperCase() + q.slice(1);

function Chip({ query, icon, onPress, onRemove }: Omit<QueryChipsProps, "queries" | "horizontal"> & { query: string }) {
  return (
    <View style={styles.chip}>
      <TouchableOpacity style={styles.chipMain} onPress={() => onPress(query)} accessibilityRole="button" accessibilityLabel={`Search ${query}`}>
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
        <Text style={styles.label} numberOfLines={1}>{capitalise(query)}</Text>
      </TouchableOpacity>
      {onRemove && (
        <TouchableOpacity style={styles.remove} onPress={() => onRemove(query)} accessibilityRole="button" accessibilityLabel={`Remove ${query}`} hitSlop={6}>
          <Ionicons name="close" size={14} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Recent searches wrap so every term stays visible above the keyboard; trending scrolls in one row to leave room below
export function QueryChips({ queries, horizontal, ...chip }: QueryChipsProps) {
  if (horizontal) {
    return (
      <FlatList
        horizontal
        data={queries}
        keyExtractor={(q) => q}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => <Chip query={item} {...chip} />}
      />
    );
  }
  return <View style={styles.wrap}>{queries.map((q) => <Chip key={q} query={q} {...chip} />)}</View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.md },
  row: { gap: spacing.sm, paddingHorizontal: spacing.md },
  chip: {
    flexDirection: "row", alignItems: "center", maxWidth: "100%",
    borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipMain: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38, paddingLeft: 12, paddingRight: 12, flexShrink: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, flexShrink: 1 },
  remove: { height: 38, paddingRight: 10, paddingLeft: 2, justifyContent: "center", marginLeft: -6 },
});
