import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "./tokens";

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  count?: number;
}

interface SegmentedTabsProps<V extends string> {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** "attention" (default) flags work waiting; "neutral" is a plain tally, e.g. search-result counts */
  countTone?: "attention" | "neutral";
}

/** Horizontally scrolling filter pills with optional counts */
export function SegmentedTabs<V extends string>({ options, value, onChange, countTone = "attention" }: SegmentedTabsProps<V>) {
  const neutral = countTone === "neutral";
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.75}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
            {o.count !== undefined && o.count > 0 && (
              <View style={[styles.count, active && styles.countActive, neutral && (active ? styles.neutralActive : styles.neutral)]}>
                <Text style={[styles.countText, tabular, active && styles.countTextActive, neutral && (active ? styles.neutralTextActive : styles.neutralText)]}>{!neutral && o.count > 99 ? "99+" : o.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14,
    borderRadius: 18, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line,
  },
  pillActive: { backgroundColor: colors.text, borderColor: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  labelActive: { color: "#fff", fontFamily: fonts.bold },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: manage.attentionBg, alignItems: "center", justifyContent: "center" },
  countActive: { backgroundColor: manage.attention },
  countText: { fontFamily: fonts.extrabold, fontSize: 11, color: manage.attentionText },
  countTextActive: { color: colors.accentText },
  neutral: { backgroundColor: manage.hairline },
  neutralActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  neutralText: { color: colors.textSecondary },
  neutralTextActive: { color: "#fff" },
});
