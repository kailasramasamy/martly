import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SettlementStatusLabels } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import { formatDate } from "../ui/dates";
import type { LedgerSummary } from "../../../lib/ledger-types";

type Owner = NonNullable<LedgerSummary["owner"]>;

interface TileProps { label: string; value: string; sub?: string; accent?: boolean; onPress?: () => void }

function Tile({ label, value, sub, accent, onPress }: TileProps) {
  return (
    <TouchableOpacity style={[styles.tile, accent && styles.accent]} onPress={onPress} disabled={!onPress} activeOpacity={0.8} accessibilityRole={onPress ? "button" : undefined}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tabular]}>{value}</Text>
      {sub ? <Text style={[styles.sub, accent && styles.accentSub]}>{sub}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={14} color={accent ? manage.attentionText : manage.muted} style={styles.chevron} /> : null}
    </TouchableOpacity>
  );
}

/** Next payout, last payout and this week's cash on delivery, for the owner */
export function PayoutTiles({ owner, codThisWeek }: { owner: Owner; codThisWeek: number }) {
  const router = useRouter();
  const { nextPayout, lastPayout } = owner;
  const needsBank = nextPayout?.status === "DRAFT";
  const openNext = () => router.push(needsBank ? "/manage/finance/payout-account" : `/manage/finance/settlements/${nextPayout?.id}`);
  const nextSub = needsBank ? "Add bank details" : nextPayout ? SettlementStatusLabels[nextPayout.status] : "Nothing scheduled";

  return (
    <View style={styles.grid}>
      <Tile label="NEXT PAYOUT" value={nextPayout ? formatINR(nextPayout.amount, { decimals: true }) : "—"} sub={nextSub} accent={needsBank} onPress={nextPayout ? openNext : undefined} />
      <Tile
        label="LAST PAYOUT"
        value={lastPayout ? formatINR(lastPayout.amount, { decimals: true }) : "—"}
        sub={lastPayout ? `${formatDate(lastPayout.paidAt)}${lastPayout.utr ? ` · UTR ${lastPayout.utr}` : ""}` : "No payouts yet"}
        onPress={lastPayout ? () => router.push(`/manage/finance/settlements/${lastPayout.id}`) : undefined}
      />
      <Tile label="COD COLLECTED THIS WEEK" value={formatINR(codThisWeek, { decimals: true })} sub="Cash your riders collected; not part of payouts" />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  tile: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 14, minHeight: 44 },
  accent: { backgroundColor: manage.attentionBg, borderColor: "#fde68a" },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, color: colors.textSecondary },
  value: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, marginTop: 2 },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2, paddingRight: 20 },
  accentSub: { fontFamily: fonts.bold, color: manage.attentionText },
  chevron: { position: "absolute", right: 12, top: "50%" },
});
