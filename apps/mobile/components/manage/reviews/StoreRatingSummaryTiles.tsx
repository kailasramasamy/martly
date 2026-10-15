import { View, StyleSheet } from "react-native";
import { KpiTile } from "../ui/KpiTile";
import type { StoreRatingSummary } from "./types";

const fmt = (v: number) => `${v.toFixed(1)} / 5`;

export function StoreRatingSummaryTiles({ summary }: { summary: StoreRatingSummary }) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <KpiTile label="Ratings" value={String(summary.count)} />
        <KpiTile label="Overall" value={fmt(summary.overall)} />
      </View>
      <View style={styles.row}>
        <KpiTile label="Delivery" value={fmt(summary.delivery)} />
        <KpiTile label="Packaging" value={fmt(summary.packaging)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
});
