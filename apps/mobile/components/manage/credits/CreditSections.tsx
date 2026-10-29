import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CreditCampaignRow } from "@martly/shared/types";
import { STORE_CREDIT_MAX_AMOUNT } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import { creditTotals } from "./describe";

/** Ink band at the top: what welcome credit has done so far across the campaigns listed */
export function CreditSummary({ rows }: { rows: CreditCampaignRow[] }) {
  const t = creditTotals(rows);
  return (
    <View style={styles.band}>
      <Text style={styles.bandTitle}>Free credit on a new customer's first order</Text>
      <View style={styles.figures}>
        <Figure value={String(t.won)} label="Customers won" />
        <Figure value={formatINR(t.spent)} label="Spent" />
        <Figure value={formatINR(t.outstanding)} label="Not used yet" />
      </View>
    </View>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

const FUNDERS = {
  martly: { icon: "shield-checkmark", title: "Martly pays", note: "Every new customer, at every store. Martly pays the store back on delivery." },
  stores: { icon: "storefront", title: "Store pays", note: "Only at that store. The store bears the cost; it's on top of Martly's credit." },
} as const;

export function FunderHeader({ funder, count }: { funder: keyof typeof FUNDERS; count: number }) {
  const f = FUNDERS[funder];
  return (
    <View style={styles.header}>
      <View style={[styles.badge, funder === "martly" ? styles.badgeMartly : styles.badgeStore]}>
        <Ionicons name={f.icon} size={16} color={funder === "martly" ? manage.inkText : colors.primaryDark} />
      </View>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{f.title} <Text style={styles.headerCount}>· {count}</Text></Text>
        <Text style={styles.headerNote}>{f.note}</Text>
      </View>
    </View>
  );
}

/** Shown in the store section when the store hasn't offered its own credit yet */
export function StoreInvite({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.invite, pressed && styles.invitePressed]} accessibilityRole="button">
      <Ionicons name="add-circle" size={26} color={colors.primary} />
      <View style={styles.headerText}>
        <Text style={styles.inviteTitle}>Offer your own welcome credit</Text>
        <Text style={styles.headerNote}>Pick the amount, up to {formatINR(STORE_CREDIT_MAX_AMOUNT)}, and a budget. You pay only when an order is delivered.</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: manage.ink, borderRadius: radius.lg, padding: 16, gap: 14 },
  bandTitle: { fontFamily: fonts.semibold, fontSize: 13, color: manage.inkMuted },
  figures: { flexDirection: "row", gap: 8 },
  figure: { flex: 1, backgroundColor: manage.inkRaised, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 },
  figureValue: { fontFamily: fonts.extrabold, fontSize: 20, color: manage.inkText, ...tabular },
  figureLabel: { fontFamily: fonts.medium, fontSize: 11, color: manage.inkMuted, marginTop: 2 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 20, paddingBottom: 10 },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badgeMartly: { backgroundColor: manage.ink },
  badgeStore: { backgroundColor: manage.tint },
  headerText: { flex: 1 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  headerCount: { fontFamily: fonts.medium, color: colors.textSecondary },
  headerNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  invite: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: radius.lg,
    borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primaryLight, backgroundColor: manage.tint,
  },
  invitePressed: { opacity: 0.8 },
  inviteTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryDark },
});
