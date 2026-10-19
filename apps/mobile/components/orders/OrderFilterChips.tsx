import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../constants/theme";
import type { OrderFilter } from "./types";

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
];

interface Props {
  value: OrderFilter;
  activeCount: number;
  onChange: (filter: OrderFilter) => void;
}

export function OrderFilterChips({ value, activeCount, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {FILTERS.map(({ key, label }) => {
        const on = key === value;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
            {key === "ACTIVE" && activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", gap: 6 },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textSecondary },
  labelOn: { color: "#fff" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontFamily: fonts.bold, color: colors.accentText },
});
