import { View, StyleSheet } from "react-native";
import { colors } from "../../../constants/theme";

interface SparklineProps {
  values: number[];
  height?: number;
  color?: string;
}

/** Micro bar sparkline built from plain Views; the last bar is emphasised */
export function Sparkline({ values, height = 28, color = colors.primary }: SparklineProps) {
  const max = Math.max(...values, 1);
  return (
    <View style={[styles.row, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.map((v, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: Math.max(2, (v / max) * height), backgroundColor: color, opacity: i === values.length - 1 ? 1 : 0.28 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { flex: 1, borderRadius: 1.5, minWidth: 2 },
});
