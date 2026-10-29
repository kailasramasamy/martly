import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { formatDate } from "../ui/dates";
import { colors, fonts, radius } from "../../../constants/theme";
import type { Entitlements } from "./plan-types";

function renewalLine(e: Entitlements): { text: string; warn?: boolean } {
  const sub = e.subscription;
  const date = formatDate(sub?.renewsAt ?? e.paidThrough);
  if (!sub) return { text: e.paidThrough ? `Paid through ${formatDate(e.paidThrough)}` : "Upgrade to Growth or Pro to run promotions" };
  if (sub.status === "HALTED") return { text: `Renewal payment failed — your plan stays active until ${date}. Choose the plan again to pay.`, warn: true };
  if (sub.status === "CREATED" && sub.renewsAt) return { text: `${sub.productName} starts on ${date}` };
  if (sub.cancelAtPeriodEnd) return { text: `Ends on ${date} · auto-renew off` };
  return { text: sub.renewsAt ? `Renews on ${date}` : `Paid through ${date}` };
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Usage({ e }: { e: Entitlements }) {
  const { promotions } = e;
  return (
    <>
      <View style={styles.stats}>
        <Stat value={`${promotions.planLeft} of ${promotions.planTotal}`} label="Promotions left" />
        <Stat value={promotions.topUpBalance} label="Extra promotions" />
        <Stat value={e.pushIncluded ? "On" : "Off"} label="Notifications" />
      </View>
      {promotions.resetsAt && promotions.planTotal > 0 ? <Text style={styles.reset}>{`Promotions reset on ${formatDate(promotions.resetsAt)}`}</Text> : null}
    </>
  );
}

interface CurrentPlanProps {
  e: Entitlements;
  canBuy: boolean;
  busy: boolean;
  /** Another purchase is running: this one waits, without spinning */
  locked: boolean;
  onCancelRenewal: () => Promise<boolean>;
  onResume: () => void;
}

/** The plan in effect, with this month's promotions, on a solid brand card so it stands apart from the plan list */
export function CurrentPlanCard({ e, canBuy, busy, locked, onCancelRenewal, onResume }: CurrentPlanProps) {
  const [confirming, setConfirming] = useState(false);
  const sub = e.subscription;
  const line = renewalLine(e);
  const renewing = sub?.status === "ACTIVE" && !sub.cancelAtPeriodEnd;
  const confirm = async () => {
    await onCancelRenewal();
    setConfirming(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Your plan</Text>
      <View style={styles.nameRow}>
        <Text style={styles.name}>{e.plan?.name ?? "Free"}</Text>
        {e.plan?.billingInterval === "YEARLY" ? <Text style={styles.chip}>Yearly</Text> : null}
      </View>
      <Text style={[styles.line, line.warn && styles.warn]}>{line.text}</Text>
      <Usage e={e} />
      {canBuy && renewing ? <Button label="Cancel auto-renew" variant="secondary" onPress={() => setConfirming(true)} disabled={locked} style={styles.btn} /> : null}
      {canBuy && sub?.cancelAtPeriodEnd ? <Button label="Turn auto-renew back on" variant="secondary" onPress={onResume} disabled={locked} loading={busy} style={styles.btn} /> : null}
      <ConfirmDialog
        visible={confirming}
        title="Cancel auto-renew?"
        message={`Your plan stays active until ${formatDate(sub?.renewsAt ?? e.paidThrough)}, then you move to Free.`}
        confirmLabel="Cancel auto-renew"
        cancelLabel="Keep auto-renew"
        running={busy}
        onConfirm={confirm}
        onClose={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: 18 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, color: "#99f6e4", letterSpacing: 0.9, textTransform: "uppercase" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  name: { fontFamily: fonts.extrabold, fontSize: 28, color: "#fff" },
  chip: { fontFamily: fonts.bold, fontSize: 11, color: colors.accentText, backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  line: { fontFamily: fonts.medium, fontSize: 13, color: "#ccfbf1", marginTop: 2, lineHeight: 18 },
  warn: { color: "#fecaca" },
  stats: { flexDirection: "row", gap: 8, marginTop: 16 },
  stat: { flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10 },
  statValue: { fontFamily: fonts.extrabold, fontSize: 20, color: "#fff" },
  statLabel: { fontFamily: fonts.medium, fontSize: 11, color: "#ccfbf1", marginTop: 2 },
  reset: { fontFamily: fonts.medium, fontSize: 12, color: "#ccfbf1", marginTop: 10 },
  btn: { marginTop: 14 },
});
