import { View, StyleSheet } from "react-native";
import { KpiTile } from "../ui/KpiTile";

export interface KpiItem {
  label: string;
  value: string;
}

/** Two-column grid of KpiTiles */
export function KpiGrid({ items }: { items: KpiItem[] }) {
  const rows: KpiItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].label} style={styles.row}>
          {row.map((k) => <KpiTile key={k.label} label={k.label} value={k.value} />)}
          {row.length === 1 && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  spacer: { flex: 1 },
});
