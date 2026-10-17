import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { api } from "../../../lib/api";
import { useResource } from "../../../lib/manage/use-resource";
import { useAuth } from "../../../lib/auth-context";
import { RazorpayCheckout } from "../../RazorpayCheckout";
import { colors, fonts } from "../../../constants/theme";
import { CurrentPlanCard, TrialCard } from "./CurrentPlanCard";
import { PlanCard, TopUpCard, UsageCard } from "./PlanSections";
import { useAdCheckout } from "./use-ad-checkout";
import { usePlanActions } from "./use-plan-actions";
import { useEntitlements } from "./use-entitlements";
import type { AdProduct } from "./plan-types";

const UPGRADE_NOTE = "Upgrading starts now; unused days of your current plan carry over as extra days. Same or cheaper plans start after your current one.";

const LINKS = [
  { title: "Results", subtitle: "Views, taps and orders from the last 30 days", icon: "stats-chart-outline", href: "/manage/marketing-plan/results" },
  { title: "Invoices", subtitle: "Receipts for what you've bought", icon: "receipt-outline", href: "/manage/marketing-plan/invoices" },
  { title: "Billing details", subtitle: "Name, GSTIN and address on invoices", icon: "business-outline", href: "/manage/marketing-plan/billing" },
] as const;

function PlanPayment({ checkout }: { checkout: ReturnType<typeof useAdCheckout> }) {
  const { user } = useAuth();
  const prefill = { email: user?.email, name: user?.name, contact: user?.phone ?? undefined };
  const { order, subscription } = checkout;
  if (order) {
    return (
      <RazorpayCheckout visible keyId={order.checkout.keyId} orderId={order.checkout.orderId} amount={order.checkout.amount} currency={order.checkout.currency}
        name="Martly Marketing" description="Marketing plan" prefill={prefill} onSuccess={checkout.onSuccess} onCancel={checkout.onCancel} />
    );
  }
  if (!subscription) return null;
  return (
    <RazorpayCheckout visible keyId={subscription.keyId} subscriptionId={subscription.subscriptionId}
      name="Martly Marketing" description={`${subscription.planName} plan`} prefill={prefill} onSuccess={checkout.onSubscribed} onCancel={checkout.onCancel} />
  );
}

export function MarketingPlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const entitlements = useEntitlements();
  const products = useResource<AdProduct[]>("/api/v1/marketing/products");
  const checkout = useAdCheckout(entitlements.reload);
  const actions = usePlanActions(entitlements.reload);
  const [quantity, setQuantity] = useState(1);
  const canBuy = can(user, "marketing-plan", "create");
  const e = entitlements.data;
  const plans = (products.data ?? []).filter((p) => p.kind === "STORE_PLAN");
  const topUp = (products.data ?? []).find((p) => p.kind === "PROMOTION_TOPUP");
  // Turning auto-renew back on buys the plan that was renewing again, from the end of the paid time
  const renewingPlan = plans.find((p) => p.code === e?.subscription?.productCode);
  const busy = checkout.running || actions.running;
  const reload = () => { entitlements.reload(); products.reload(); };

  return (
    <ManageStackScreen title="Marketing plan" loading={entitlements.loading || products.loading} error={entitlements.error ?? products.error} onRetry={reload} onRefresh={reload}>
      {e ? (
        <>
          {e.trial.available ? <TrialCard canBuy={canBuy} busy={busy} onStart={actions.startTrial} /> : null}
          <CurrentPlanCard e={e} canBuy={canBuy} busy={busy} onCancelRenewal={actions.cancelRenewal} onResume={() => renewingPlan && checkout.subscribe(renewingPlan)} />
          <UsageCard e={e} />
          {canBuy ? null : <Text style={styles.note}>Only the owner can buy</Text>}
          <Text style={styles.note}>{UPGRADE_NOTE}</Text>
          {plans.map((p) => (
            <PlanCard key={p.id} product={p} e={e} canBuy={canBuy} busy={busy} onBuy={() => checkout.subscribe(p)} />
          ))}
          {topUp ? <TopUpCard onPaidPlan={e.onPaidPlan} product={topUp} quantity={quantity} onQuantity={setQuantity} canBuy={canBuy} busy={busy} onBuy={() => checkout.buy(topUp.id, quantity)} /> : null}
          <SectionCard flush>
            {LINKS.map((l) => <ListRow key={l.title} title={l.title} subtitle={l.subtitle} icon={l.icon} chevron onPress={() => router.push(l.href)} />)}
          </SectionCard>
        </>
      ) : null}
      <PlanPayment checkout={checkout} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
});
