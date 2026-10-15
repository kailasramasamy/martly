import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  formatValue: (value: number) => string;
  height?: number;
}

/** Plain-View bar chart: the last bar (today) is emphasised, tap any bar to read its value */
export function BarChart({ data, formatValue, height = 120 }: BarChartProps) {
  const lastIndex = data.length - 1;
  const [selected, setSelected] = useState(lastIndex);
  const index = Math.min(selected, lastIndex);
  const max = Math.max(...data.map((d) => d.value), 1);

  if (data.length === 0) return null;

  return (
    <View>
      <View style={styles.readout}>
        <Text style={[styles.readoutValue, tabular]}>{formatValue(data[index].value)}</Text>
        <Text style={styles.readoutLabel}>{index === lastIndex ? "Today" : data[index].label}</Text>
      </View>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => {
          const active = i === index;
          return (
            <TouchableOpacity
              key={`${d.label}-${i}`}
              style={styles.column}
              onPress={() => setSelected(i)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(3, (d.value / max) * height),
                    backgroundColor: i === lastIndex ? colors.primary : colors.primaryLight,
                    opacity: active ? 1 : 0.55,
                  },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <Text key={`${d.label}-${i}`} style={[styles.tick, i === index && styles.tickActive]} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
  readoutValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, letterSpacing: -0.4 },
  readoutLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 8, borderBottomWidth: 1, borderBottomColor: manage.line },
  column: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  axis: { flexDirection: "row", gap: 8, marginTop: 6 },
  tick: { flex: 1, textAlign: "center", fontFamily: fonts.medium, fontSize: 11, color: manage.muted },
  tickActive: { fontFamily: fonts.bold, color: colors.text },
});
