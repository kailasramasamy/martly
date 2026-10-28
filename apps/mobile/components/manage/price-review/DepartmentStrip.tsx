import { ScrollView, TouchableOpacity, View, Text, StyleSheet } from "react-native";
import type { PriceReviewDepartment } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

interface Props {
  departments: PriceReviewDepartment[];
  value: string | null;
  onChange: (id: string | null) => void;
}

/** One chip per department with its own progress; tapping narrows the brands and aisles below to it */
export function DepartmentStrip({ departments, value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {departments.map((d) => {
        const active = d.id === value;
        const done = d.total - d.pending;
        return (
          <TouchableOpacity
            key={d.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(active ? null : d.id)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${d.name}: ${d.pending} prices to check`}
          >
            <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>{d.name}</Text>
            <View style={styles.track}><View style={[styles.fill, { flex: done }]} /><View style={{ flex: d.pending }} /></View>
            <Text style={[styles.meta, tabular, active && styles.metaActive]}>
              {d.pending === 0 ? "All checked" : `${d.pending.toLocaleString("en-IN")} to go`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 16 },
  chip: { width: 132, padding: 10, gap: 6, borderRadius: radius.lg, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line },
  chipActive: { borderColor: colors.primary, backgroundColor: manage.tint },
  name: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  nameActive: { color: colors.primaryDark },
  track: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: manage.hairline },
  fill: { backgroundColor: colors.primary },
  meta: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  metaActive: { color: colors.primaryDark },
});
