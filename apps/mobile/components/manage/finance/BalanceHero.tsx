import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import { runDay } from "./format";
import type { LedgerSummary } from "../../../lib/ledger-types";

function Figure({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tabular, value < 0 && styles.negative]}>{formatINR(value, { decimals: true })}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

/** The two numbers that matter: what pays out on the next run, and what is still inside the return window */
export function BalanceHero({ summary }: { summary: LedgerSummary }) {
  return (
    <View style={styles.card}>
      <View style={[styles.ring, styles.ringOuter]} />
      <View style={[styles.ring, styles.ringInner]} />
      <Figure label="AVAILABLE" value={summary.available} note={`Settles on the next run, ${runDay(summary.nextRunAt)}`} />
      <View style={styles.divider} />
      <Figure label="ON HOLD" value={summary.onHold} note="Released once the return window ends" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.ink, borderRadius: radius.xl, padding: 18, gap: 14, overflow: "hidden" },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "rgba(52,211,153,0.2)" },
  ringOuter: { width: 220, height: 220, right: -90, top: -100 },
  ringInner: { width: 140, height: 140, right: -45, top: -55, borderColor: "rgba(52,211,153,0.32)" },
  figure: { gap: 2 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, color: manage.live },
  value: { fontFamily: fonts.extrabold, fontSize: 34, color: "#fff" },
  negative: { color: "#fca5a5" },
  note: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.inkMuted },
  divider: { height: 1, backgroundColor: manage.inkRaised },
});
