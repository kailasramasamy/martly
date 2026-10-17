import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { formatDate } from "../ui/dates";
import { colors, fonts } from "../../../constants/theme";
import type { Entitlements } from "./plan-types";

interface TrialCardProps {
  canBuy: boolean;
  busy: boolean;
  onStart: () => void;
}

export function TrialCard({ canBuy, busy, onStart }: TrialCardProps) {
  return (
    <SectionCard style={styles.trial}>
      <Text style={styles.name}>Try Growth free for 14 days</Text>
      <Text style={styles.muted}>2 promotions and 2 AI images, no payment needed</Text>
      {canBuy ? <Button label="Start free trial" onPress={onStart} loading={busy} style={styles.btn} /> : null}
    </SectionCard>
  );
}

function renewalLine(e: Entitlements): { text: string; warn?: boolean } {
  const sub = e.subscription;
  const date = formatDate(sub?.renewsAt ?? e.paidThrough);
  if (!sub) return { text: e.paidThrough ? `Paid through ${formatDate(e.paidThrough)}` : "Free plan" };
  if (sub.status === "HALTED") return { text: `Renewal payment failed — your plan stays active until ${date}. Choose the plan again to pay.`, warn: true };
  if (sub.status === "CREATED" && sub.renewsAt) return { text: `${sub.productName} starts on ${date}` };
  if (sub.cancelAtPeriodEnd) return { text: `Ends on ${date} · auto-renew off` };
  return { text: sub.renewsAt ? `Renews on ${date}` : `Paid through ${date}` };
}

interface CurrentPlanProps {
  e: Entitlements;
  canBuy: boolean;
  busy: boolean;
  onCancelRenewal: () => Promise<boolean>;
  onResume: () => void;
}

export function CurrentPlanCard({ e, canBuy, busy, onCancelRenewal, onResume }: CurrentPlanProps) {
  const [confirming, setConfirming] = useState(false);
  const sub = e.subscription;
  const line = renewalLine(e);
  const renewing = sub?.status === "ACTIVE" && !sub.cancelAtPeriodEnd;
  const confirm = async () => {
    await onCancelRenewal();
    setConfirming(false);
  };

  return (
    <SectionCard title="Your plan">
      <Text style={styles.name}>{e.plan ? `${e.plan.name}${e.plan.billingInterval === "YEARLY" ? " · billed yearly" : ""}` : "Free"}</Text>
      {e.trial.endsAt ? (
        <>
          <Text style={styles.muted}>{`Free trial · ends ${formatDate(e.trial.endsAt)}`}</Text>
          <Text style={styles.muted}>Choose a plan to keep going after the trial</Text>
        </>
      ) : (
        <Text style={[styles.muted, line.warn && styles.warn]}>{line.text}</Text>
      )}
      {canBuy && renewing ? <Button label="Cancel auto-renew" variant="secondary" onPress={() => setConfirming(true)} style={styles.btn} /> : null}
      {canBuy && sub?.cancelAtPeriodEnd ? <Button label="Turn auto-renew back on" onPress={onResume} loading={busy} style={styles.btn} /> : null}
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
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  trial: { borderColor: colors.primary, borderWidth: 2, backgroundColor: "#f0fdfa" },
  name: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  warn: { color: colors.error },
  btn: { marginTop: 12 },
});
