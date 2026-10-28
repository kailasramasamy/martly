import { View, Text, StyleSheet } from "react-native";
import type { PriceReviewSummary } from "@martly/shared/types";
import type { PriceReviewOutcome } from "@martly/shared/constants";
import { fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

/** How a row was settled: a price outcome, or ruled out as not sold here (which leaves the price queue) */
export type Settled = PriceReviewOutcome | "notCarried";

/** Kept and changed share one bar, so the manager sees both how far along and how much actually moved */
export const OUTCOME_TONES = {
  KEPT: { label: "Kept", color: manage.live },
  CHANGED: { label: "Changed", color: "#fbbf24" },
  notCarried: { label: "Not sold", color: "#94a3b8" },
} as const;

const count = (n: number) => n.toLocaleString("en-IN");

export function ProgressHero({ summary }: { summary: PriceReviewSummary }) {
  const pct = summary.total ? Math.floor((summary.reviewed / summary.total) * 100) : 0;
  const parts = [
    { key: "KEPT", value: summary.kept },
    { key: "CHANGED", value: summary.changed },
  ] as const;
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <View>
          <Text style={styles.eyebrow}>PRICES CHECKED</Text>
          <Text style={[styles.pct, tabular]}>{pct}<Text style={styles.pctSign}>%</Text></Text>
        </View>
        {summary.reviewedToday > 0 && (
          <View style={styles.today}><Text style={[styles.todayText, tabular]}>+{count(summary.reviewedToday)} today</Text></View>
        )}
      </View>
      <Text style={[styles.of, tabular]}>
        {count(summary.reviewed)} of {count(summary.total)} · <Text style={styles.left}>{count(summary.pending)} to go</Text>
      </Text>
      <View style={styles.track}>
        {parts.map((p) => p.value > 0 && (
          <View key={p.key} style={{ flex: p.value, backgroundColor: OUTCOME_TONES[p.key].color }} />
        ))}
        {summary.pending > 0 && <View style={{ flex: summary.pending }} />}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: OUTCOME_TONES[p.key].color }]} />
            <Text style={[styles.legendText, tabular]}>{OUTCOME_TONES[p.key].label} {count(p.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: manage.ink, borderRadius: radius.xl, padding: 18, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: manage.inkMuted },
  pct: { fontFamily: fonts.extrabold, fontSize: 44, lineHeight: 50, color: manage.inkText, letterSpacing: -1.5 },
  pctSign: { fontSize: 24, color: manage.inkMuted },
  today: { backgroundColor: manage.inkRaised, borderRadius: radius.xl, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2 },
  todayText: { fontFamily: fonts.bold, fontSize: 12, color: manage.live },
  of: { fontFamily: fonts.semibold, fontSize: 14, color: manage.inkText },
  left: { color: manage.inkMuted },
  track: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: manage.inkRaised, marginTop: 8 },
  legend: { flexDirection: "row", gap: 14, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.semibold, fontSize: 12, color: manage.inkMuted },
});
