import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { MembershipPlan } from "../../lib/types";

const MONTHS: Record<MembershipPlan["duration"], number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };
const PERIOD: Record<MembershipPlan["duration"], string> = { MONTHLY: "month", QUARTERLY: "quarter", ANNUAL: "year" };
const LABEL: Record<MembershipPlan["duration"], string> = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annual" };

export const perMonth = (plan: MembershipPlan) => Number(plan.price) / MONTHS[plan.duration];
const rupees = (n: number) => `\u20B9${Math.round(n).toLocaleString("en-IN")}`;

interface Props {
  plan: MembershipPlan;
  /** Price of the monthly plan, to show how much longer plans save */
  monthlyPrice?: number;
  bestValue: boolean;
  busy: boolean;
  disabled: boolean;
  onSubscribe: (plan: MembershipPlan) => void;
}

function Perk({ text }: { text: string }) {
  return (
    <View style={styles.perk}>
      <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
      <Text style={styles.perkText}>{text}</Text>
    </View>
  );
}

export function PlanCard({ plan, monthlyPrice, bestValue, busy, disabled, onSubscribe }: Props) {
  const monthly = perMonth(plan);
  const savePct = monthlyPrice && plan.duration !== "MONTHLY" ? Math.round((1 - monthly / monthlyPrice) * 100) : 0;
  return (
    <View style={[styles.card, bestValue && styles.cardBest]}>
      {bestValue && (
        <View style={styles.ribbon}>
          <Ionicons name="star" size={11} color={colors.accentText} />
          <Text style={styles.ribbonText}>BEST VALUE</Text>
        </View>
      )}
      <Text style={styles.duration}>{LABEL[plan.duration]}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{rupees(Number(plan.price))}</Text>
        <Text style={styles.period}>/{PERIOD[plan.duration]}</Text>
      </View>
      {plan.duration !== "MONTHLY" && (
        <Text style={styles.equivalent}>
          {rupees(monthly)}/month{savePct > 0 && <Text style={styles.save}>{"  ·  "}Save {savePct}%</Text>}
        </Text>
      )}
      <View style={styles.perks}>
        {plan.freeDelivery && <Perk text="Free delivery on every order" />}
        {plan.loyaltyMultiplier > 1 && <Perk text={`${plan.loyaltyMultiplier}× loyalty points`} />}
        <Perk text="Exclusive member prices" />
      </View>
      <TouchableOpacity
        style={[styles.button, bestValue && styles.buttonBest]}
        onPress={() => onSubscribe(plan)}
        disabled={disabled}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator size="small" color={bestValue ? colors.accentText : "#fff"} />
        ) : (
          <Text style={[styles.buttonText, bestValue && styles.buttonTextBest]}>Get {LABEL[plan.duration]}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  cardBest: {
    borderWidth: 2, borderColor: colors.accent,
    shadowColor: "#b45309", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  ribbon: {
    position: "absolute", top: -11, right: 16, flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  ribbonText: { fontFamily: fonts.extrabold, fontSize: 10.5, color: colors.accentText, letterSpacing: 0.5 },
  duration: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  price: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.text, letterSpacing: -0.5 },
  period: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary, marginLeft: 3 },
  equivalent: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  save: { fontFamily: fonts.extrabold, color: "#b45309" },
  perks: { gap: 8, marginTop: 14, marginBottom: 16 },
  perk: { flexDirection: "row", alignItems: "center", gap: 8 },
  perkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  button: { height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  buttonBest: { backgroundColor: colors.accent },
  buttonText: { fontFamily: fonts.bold, fontSize: 15.5, color: "#fff" },
  buttonTextBest: { color: colors.accentText },
});
