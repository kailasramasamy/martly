import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useResource } from "../../../lib/manage/use-resource";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import { runDay } from "../finance/format";
import type { LedgerSummary } from "../../../lib/ledger-types";

function headline(s: LedgerSummary): { title: string; sub: string; warn: boolean } {
  const balance = s.available + (s.owner?.carried ?? 0);
  if (balance < 0) return { title: `Balance −${formatINR(Math.abs(balance))}`, sub: "Recovered from your next payouts", warn: true };
  const amount = s.owner?.nextPayout?.amount ?? s.available;
  return { title: `${formatINR(amount)} payout on Monday`, sub: runDay(s.nextRunAt), warn: false };
}

/** The owner's payout at a glance on Today; taps through to Payments & payouts */
export function PayoutCard() {
  const router = useRouter();
  const { data } = useResource<LedgerSummary>("/api/v1/ledger/summary");
  if (!data?.owner) return null;
  const { title, sub, warn } = headline(data);
  return (
    <TouchableOpacity style={[styles.card, warn && styles.warn]} onPress={() => router.push("/manage/finance")} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Payments and payouts">
      <View style={[styles.icon, warn && styles.warnIcon]}>
        <Ionicons name={warn ? "alert-circle-outline" : "cash-outline"} size={20} color={warn ? manage.attentionText : colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, tabular]}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={manage.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 64, backgroundColor: manage.tint, borderRadius: radius.xl, borderWidth: 1, borderColor: "#c7f0e6" },
  warn: { backgroundColor: manage.attentionBg, borderColor: "#fde68a" },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  warnIcon: { backgroundColor: "#fde68a" },
  text: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
});
