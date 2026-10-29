import { View, Text, StyleSheet } from "react-native";
import type { CreditCampaignUsage } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";

const share = (n: number, budget: number) => (budget > 0 ? Math.min(100, (n / budget) * 100) : 0);

/** The budget as one bar: spent on delivered orders, held by placed orders, and given but not used yet (not counted) */
export function BudgetMeter({ budget, usage }: { budget: number; usage: CreditCampaignUsage }) {
  const spent = share(usage.spent, budget);
  const held = Math.min(100 - spent, share(usage.reserved, budget));
  const unused = Math.min(100 - spent - held, share(usage.outstanding, budget));
  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.used}>
          {formatINR(usage.committed)}<Text style={styles.of}> of {formatINR(budget)} budget</Text>
        </Text>
        <Text style={styles.pct}>{Math.round(share(usage.committed, budget))}%</Text>
      </View>
      <View style={styles.track} accessibilityLabel={`${formatINR(usage.committed)} of ${formatINR(budget)} budget used`}>
        <View style={[styles.spent, { width: `${spent}%` }]} />
        <View style={[styles.held, { width: `${held}%` }]} />
        <View style={[styles.unused, { width: `${unused}%` }]} />
      </View>
      <View style={styles.legend}>
        <Legend swatch={styles.spent} label="Spent" value={usage.spent} />
        <Legend swatch={styles.held} label="In orders" value={usage.reserved} />
        <Legend swatch={styles.unused} label="Not used yet" value={usage.outstanding} />
      </View>
    </View>
  );
}

function Legend({ swatch, label, value }: { swatch: object; label: string; value: number }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, swatch]} />
      <Text style={styles.legendText}>{label} <Text style={styles.legendValue}>{formatINR(value)}</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 },
  used: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, ...tabular },
  of: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  pct: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, ...tabular },
  track: { flexDirection: "row", height: 10, borderRadius: 5, backgroundColor: manage.hairline, overflow: "hidden" },
  spent: { backgroundColor: colors.primary },
  held: { backgroundColor: colors.primaryLight },
  unused: { backgroundColor: manage.tint, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primaryLight },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  legendValue: { fontFamily: fonts.semibold, color: colors.text, ...tabular },
});
