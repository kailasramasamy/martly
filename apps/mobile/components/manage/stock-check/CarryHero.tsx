import { View, Text, StyleSheet } from "react-native";
import type { StockCheckSummary } from "@martly/shared/types";
import { fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

export const CARRY_TONES = {
  carried: { label: "Carried", color: manage.live },
  notCarried: { label: "Not sold", color: "#94a3b8" },
} as const;

const count = (n: number) => n.toLocaleString("en-IN");

/** How much of the onboarded range is confirmed, split into what the store carries and what it doesn't */
export function CarryHero({ summary }: { summary: StockCheckSummary }) {
  const confirmed = summary.carried + summary.notCarried;
  const pct = summary.total ? Math.floor((confirmed / summary.total) * 100) : 0;
  const deptsLeft = summary.departments.filter((d) => d.unchecked > 0).length;
  const parts = [{ key: "carried", value: summary.carried }, { key: "notCarried", value: summary.notCarried }] as const;
  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <View>
          <Text style={styles.eyebrow}>RANGE CONFIRMED</Text>
          <Text style={[styles.pct, tabular]}>{pct}<Text style={styles.pctSign}>%</Text></Text>
        </View>
        {summary.checkedToday > 0 && (
          <View style={styles.today}><Text style={[styles.todayText, tabular]}>+{count(summary.checkedToday)} today</Text></View>
        )}
      </View>
      <Text style={[styles.of, tabular]}>
        {count(confirmed)} of {count(summary.total)}
        {deptsLeft > 0 && <Text style={styles.left}> · {deptsLeft} {deptsLeft === 1 ? "department" : "departments"} left</Text>}
      </Text>
      <View style={styles.track}>
        {parts.map((p) => p.value > 0 && <View key={p.key} style={{ flex: p.value, backgroundColor: CARRY_TONES[p.key].color }} />)}
        {summary.unchecked > 0 && <View style={{ flex: summary.unchecked }} />}
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: CARRY_TONES[p.key].color }]} />
            <Text style={[styles.legendText, tabular]}>{CARRY_TONES[p.key].label} {count(p.value)}</Text>
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
  legend: { flexDirection: "row", gap: 16, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.inkMuted },
});
