import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";
import { useEntitlements } from "../marketing/use-entitlements";
import type { Entitlements } from "../marketing/plan-types";

const PLAN_HREF = "/manage/marketing-plan";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** On Free: an invitation to start the trial, or to see the plans */
function PromoStrip({ trial, onPress }: { trial: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.promo} onPress={onPress} activeOpacity={0.9} accessibilityRole="button"
      accessibilityLabel={trial ? "Try Growth free for 14 days" : "See marketing plans"}>
      <View style={[styles.ring, styles.ringOuter]} />
      <View style={[styles.ring, styles.ringInner]} />
      <Text style={styles.eyebrow}>MARKETING</Text>
      <Text style={styles.promoTitle}>{trial ? "Try Growth free for 14 days" : "Bring more shoppers in"}</Text>
      <Text style={styles.promoBody}>
        {trial
          ? "2 promotions and 2 AI-made banners a month on your home screen. No payment needed."
          : "Run discounts with a banner on your home screen, from ₹833 a month."}
      </Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{trial ? "Start free trial" : "See plans"}</Text>
        <Ionicons name="arrow-forward" size={15} color={colors.accentText} />
      </View>
    </TouchableOpacity>
  );
}

function renewal(e: Entitlements): { text: string; warn?: boolean } {
  const sub = e.subscription;
  if (e.trial.endsAt) return { text: `Free trial · ends ${shortDate(e.trial.endsAt)}` };
  if (sub?.status === "HALTED") return { text: "Renewal payment failed", warn: true };
  if (sub?.cancelAtPeriodEnd && sub.renewsAt) return { text: `Ends ${shortDate(sub.renewsAt)} · auto-renew off` };
  if (sub?.status === "ACTIVE" && sub.renewsAt) return { text: `Renews ${shortDate(sub.renewsAt)}${sub.interval === "YEARLY" ? " · yearly" : ""}` };
  return { text: e.paidThrough ? `Paid through ${shortDate(e.paidThrough)}` : "" };
}

function Meter({ label, left, used, total, extra }: { label: string; left: number; used: number; total: number; extra?: number }) {
  const empty = left === 0;
  return (
    <View style={styles.meter}>
      <Text style={styles.meterLabel}>{label}</Text>
      <Text style={[styles.meterValue, tabular, empty && styles.meterEmpty]}>{left} left</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${total ? Math.min(100, (used / total) * 100) : 100}%` }, empty && styles.fillEmpty]} />
      </View>
      <Text style={[styles.meterSub, tabular]}>{`${used} of ${total} used${extra ? ` · +${extra} extra` : ""}`}</Text>
    </View>
  );
}

/** On a plan or trial: what it is, how it renews, and how much of this month's allowance is left */
function PlanStatusStrip({ e, onPress }: { e: Entitlements; onPress: () => void }) {
  const status = renewal(e);
  const p = e.promotions;
  const promosLeft = p.planLeft + p.topUpBalance;
  const outOnGrowth = e.plan?.code === "GROWTH" && promosLeft === 0;
  return (
    <TouchableOpacity style={styles.status} onPress={onPress} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Marketing plan">
      <View style={[styles.ring, styles.statusRingOuter]} />
      <View style={[styles.ring, styles.statusRingInner]} />
      <View style={styles.statusHead}>
        <View style={styles.planPill}><Text style={styles.planPillText}>{e.plan?.name.toUpperCase()}</Text></View>
        <Text style={[styles.statusText, status.warn && styles.warnText]} numberOfLines={1}>{status.text}</Text>
        <Ionicons name="chevron-forward" size={18} color={manage.muted} />
      </View>
      <View style={styles.meters}>
        <Meter label="Promotions" left={promosLeft} used={p.planUsed} total={p.planTotal} extra={p.topUpBalance} />
        <Meter label="AI images" left={Math.max(0, e.aiImages.total - e.aiImages.used)} used={e.aiImages.used} total={e.aiImages.total} />
      </View>
      {outOnGrowth && (
        <View style={styles.nudge}>
          <Ionicons name="rocket-outline" size={15} color={manage.attentionText} />
          <Text style={styles.nudgeText}>Out of promotions this month · Upgrade to Pro for 6 a month</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** The marketing plan at a glance on Today: an invitation on Free, usage on a plan */
export function MarketingPlanStrip() {
  const router = useRouter();
  const { data, reload } = useEntitlements();
  useRefreshOnFocus(reload);
  if (!data) return null;
  const open = () => router.push(PLAN_HREF);
  const onPlan = data.onPaidPlan || !!data.trial.endsAt;
  return onPlan ? <PlanStatusStrip e={data} onPress={open} /> : <PromoStrip trial={data.trial.available} onPress={open} />;
}

const styles = StyleSheet.create({
  promo: { backgroundColor: manage.ink, borderRadius: radius.xl, padding: 18, overflow: "hidden", minHeight: 44 },
  ring: { position: "absolute", borderRadius: 999, borderWidth: 1, borderColor: "rgba(251,191,36,0.22)" },
  ringOuter: { width: 190, height: 190, right: -70, top: -80 },
  ringInner: { width: 120, height: 120, right: -35, top: -45, borderColor: "rgba(251,191,36,0.34)" },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.6, color: colors.accent },
  promoTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: "#fff", marginTop: 6, maxWidth: "85%" },
  promoBody: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: manage.inkMuted, marginTop: 6, maxWidth: "92%" },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 14,
    backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 16, minHeight: 40,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 14, color: colors.accentText },
  // Same ring motif as the promo card, in the brand teal on a pale wash
  status: { backgroundColor: "#ecfdf8", borderRadius: radius.xl, borderWidth: 1, borderColor: "#c7f0e6", padding: 14, gap: 12, overflow: "hidden" },
  statusRingOuter: { width: 180, height: 180, right: -60, top: -95, borderColor: "rgba(15,118,110,0.12)" },
  statusRingInner: { width: 110, height: 110, right: -25, top: -60, borderColor: "rgba(15,118,110,0.2)" },
  statusHead: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  planPill: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  planPillText: { fontFamily: fonts.extrabold, fontSize: 11.5, letterSpacing: 1, color: "#fff" },
  statusText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  warnText: { color: colors.error },
  meters: { flexDirection: "row", gap: 14 },
  meter: { flex: 1 },
  meterLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  meterValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, marginTop: 2 },
  meterEmpty: { color: manage.attentionText },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(15,118,110,0.12)", marginTop: 6, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  fillEmpty: { backgroundColor: colors.accent },
  meterSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary, marginTop: 5 },
  nudge: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: manage.attentionBg,
    borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 8,
  },
  nudgeText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: manage.attentionText },
});
