import { View, StyleSheet } from "react-native";
import { KpiTile } from "../ui/KpiTile";
import type { StockSummary } from "./types";

export function StockTiles({ summary }: { summary: StockSummary | null }) {
  const t = summary?.totals;
  const fmt = (n: number | undefined) => (n === undefined ? "—" : n.toLocaleString("en-IN"));
  return (
    <View style={styles.grid}>
      <View style={styles.cell}><KpiTile label="Total SKUs" value={fmt(t?.totalSKUs)} /></View>
      <View style={styles.cell}><KpiTile label="In stock" value={fmt(t?.inStock)} /></View>
      <View style={styles.cell}><KpiTile label="Low stock" value={fmt(t?.lowStock)} /></View>
      <View style={styles.cell}><KpiTile label="Out of stock" value={fmt(t?.outOfStock)} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48%", flexGrow: 1 },
});
