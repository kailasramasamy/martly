import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
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

function Details({ summary }: { summary: DaySummary }) {
  return (
    <View style={styles.details}>
      <View style={styles.row}>
        <Stat value={String(summary.delivered)} label="Delivered" tone="#15803d" />
        <Stat value={String(summary.failed)} label="Failed" tone={summary.failed > 0 ? colors.error : undefined} />
        <Stat value={formatINR(summary.cashCollected)} label="Cash in hand" />
      </View>
      {summary.upiCollected > 0 && <Text style={[styles.note, tabular]}>+ {formatINR(summary.upiCollected)} paid by UPI to the store</Text>}
      {summary.cashToCollect > 0 && <Text style={[styles.note, tabular]}>{formatINR(summary.cashToCollect)} still to collect on open stops</Text>}
    </View>
  );
}

/** The day in one line — what the rider is carrying back to the store — that opens into the full numbers */
export function DaySummaryCard({ summary }: { summary: DaySummary }) {
  const [open, setOpen] = useState(false);
  const returns = summary.returnsToHandOver;
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.line} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Ionicons name="wallet-outline" size={18} color={colors.text} />
        <Text style={[styles.cash, tabular]}>{formatINR(summary.cashCollected)}</Text>
        <Text style={styles.muted}>in hand</Text>
        {returns > 0 && (
          <View style={styles.returns}>
            <Ionicons name="return-down-back-outline" size={15} color={manage.attentionText} />
            <Text style={[styles.returnsText, tabular]}>{returns} to hand over</Text>
          </View>
        )}
        <View style={styles.spacer} />
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {open && <Details summary={summary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line },
  line: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 52, paddingHorizontal: 14 },
  cash: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  returns: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: manage.attentionBg },
  returnsText: { fontFamily: fonts.bold, fontSize: 13, color: manage.attentionText },
  spacer: { flex: 1 },
  details: { gap: 8, paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: manage.hairline, paddingTop: 12 },
  row: { flexDirection: "row" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  note: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, textAlign: "center" },
});
