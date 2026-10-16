import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { formatINR, manage, tabular } from "../ui/tokens";
import type { DaySummary } from "./types";

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.value, tabular, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

/** The day at a glance: delivered, failed, cash in hand, and what's still to collect */
export function DaySummaryCard({ summary }: { summary: DaySummary }) {
  return (
    <SectionCard>
      <View style={styles.row}>
        <Stat value={String(summary.delivered)} label="Delivered" tone="#15803d" />
        <Stat value={String(summary.failed)} label="Failed" tone={summary.failed > 0 ? colors.error : undefined} />
        <Stat value={formatINR(summary.cashCollected)} label="Cash in hand" />
      </View>
      {summary.upiCollected > 0 && (
        <Text style={[styles.upi, tabular]}>+ {formatINR(summary.upiCollected)} paid by UPI to the store</Text>
      )}
      {summary.cashToCollect > 0 && (
        <View style={styles.due}>
          <Text style={[styles.dueText, tabular]}>{formatINR(summary.cashToCollect)} still to collect</Text>
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  due: { marginTop: 12, alignItems: "center", paddingVertical: 8, borderRadius: 10, backgroundColor: manage.attentionBg },
  upi: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: "right" },
  dueText: { fontFamily: fonts.extrabold, fontSize: 14.5, color: manage.attentionText },
});
