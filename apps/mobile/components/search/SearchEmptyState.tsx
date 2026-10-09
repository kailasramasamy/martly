import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../../constants/theme";

interface SearchEmptyStateProps {
  filtered: boolean;
  hasQuery: boolean;
  onClearFilters: () => void;
}

export function SearchEmptyState({ filtered, hasQuery, onClearFilters }: SearchEmptyStateProps) {
  if (filtered) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>No products match these filters</Text>
        <TouchableOpacity style={styles.btn} onPress={onClearFilters}>
          <Text style={styles.btnText}>Clear filters</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{hasQuery ? "No products found" : "Start typing to search"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", marginTop: spacing.xl, gap: spacing.md },
  text: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 14 },
  btn: { minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontFamily: fonts.bold, fontSize: 14 },
});
