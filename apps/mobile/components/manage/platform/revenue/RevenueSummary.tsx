import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { KpiTile } from "../../ui/KpiTile";
import { formatINR } from "../../ui/tokens";
import type { Totals } from "./types";

function Row({ label, totals }: { label: string; totals: Totals | undefined }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <KpiTile label="Orders" value={String(totals?.orders ?? 0)} />
        <KpiTile label="Net" value={formatINR(totals?.net ?? 0)} />
        <KpiTile label="Total incl. GST" value={formatINR(totals?.total ?? 0)} />
      </View>
    </View>
  );
}

export function RevenueSummary({ thisMonth, allTime }: { thisMonth: Totals | undefined; allTime: Totals | undefined }) {
  return (
    <View style={styles.block}>
      <Row label="This month" totals={thisMonth} />
      <Row label="All time" totals={allTime} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  row: { flexDirection: "row", gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase" },
});
