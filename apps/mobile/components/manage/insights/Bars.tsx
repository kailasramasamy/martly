import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

interface BarRowProps {
  label: string;
  value: number;
  max: number;
  display?: string;
  color?: string;
}

/** Horizontal bar built from plain Views; the fill is proportional to value/max */
export function BarRow({ label, value, max, display, color = colors.primary }: BarRowProps) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.value, tabular]}>{display ?? String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  label: { width: 44, fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: manage.hairline, overflow: "hidden" },
  fill: { height: 10, borderRadius: 5 },
  value: { minWidth: 36, textAlign: "right", fontFamily: fonts.bold, fontSize: 13, color: colors.text },
});
