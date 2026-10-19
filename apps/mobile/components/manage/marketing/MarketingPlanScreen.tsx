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
import { colors, fonts } from "../../../constants/theme";
import { PlanPayment } from "./PlanPayment";
import { ImagePackList } from "./ImagePackList";
import { imagePacks } from "./ai-images";
import { CurrentPlanCard, TrialCard } from "./CurrentPlanCard";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { PlanCard, TopUpCard, UsageCard } from "./PlanSections";
import { useAdCheckout } from "./use-ad-checkout";
import { usePlanActions } from "./use-plan-actions";
import { useEntitlements } from "./use-entitlements";
import type { AdProduct, BillingInterval } from "./plan-types";

const UPGRADE_NOTE = "Upgrading starts now; unused days of your current plan carry over as extra days. Same or cheaper plans start after your current one.";

const INTERVAL_OPTIONS = [
  { value: "MONTHLY" as const, label: "Monthly" },
  { value: "YEARLY" as const, label: "Annual \u00B7 2 months free" },
];

const LINKS = [
  { title: "Results", subtitle: "Views, taps and orders from the last 30 days", icon: "stats-chart-outline", href: "/manage/marketing-plan/results" },
  { title: "Invoices", subtitle: "Receipts for what you've bought", icon: "receipt-outline", href: "/manage/marketing-plan/invoices" },
  { title: "Billing details", subtitle: "Name, GSTIN and address on invoices", icon: "business-outline", href: "/manage/marketing-plan/billing" },
] as const;

type PacksProps = { packs: AdProduct[]; canBuy: boolean; pendingId: string | null; locked: boolean; onBuy: (pack: AdProduct) => void };

function ImagePacksCard({ packs, ...list }: PacksProps) {
  return (
    <SectionCard title="AI image packs">
      <Text style={[styles.note, styles.packNote]}>Used after your monthly AI images run out; they never expire. Available on every plan, including Free.</Text>
      <ImagePackList packs={packs} {...list} />
    </SectionCard>
  );
}

/** Only the button that was tapped spins; the rest wait, disabled, until it finishes */
function useTapped(locked: boolean) {
  const [tapped, setTapped] = useState<string | null>(null);
  const busy = (key: string) => locked && tapped === key;
  const tap = (key: string, run: () => void) => () => { setTapped(key); run(); };
  return { tapped, setTapped, locked, busy, tap };
}

export function MarketingPlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const entitlements = useEntitlements();
  const products = useResource<AdProduct[]>("/api/v1/marketing/products");
  const checkout = useAdCheckout(entitlements.reload);
  const actions = usePlanActions(entitlements.reload);
  const [quantity, setQuantity] = useState(1);
  const [pickedInterval, setPickedInterval] = useState<BillingInterval | null>(null);
  const canBuy = can(user, "marketing-plan", "create");
  const e = entitlements.data;
  const interval = pickedInterval ?? e?.plan?.billingInterval ?? "MONTHLY";
  const plans = (products.data ?? []).filter((p) => p.kind === "STORE_PLAN");
  const packs = imagePacks(products.data);
  const topUp = (products.data ?? []).find((p) => p.kind === "PROMOTION_TOPUP");
  // Turning auto-renew back on buys the plan that was renewing again, from the end of the paid time
  const renewingPlan = plans.find((p) => p.code === e?.subscription?.productCode);
  const { tapped, setTapped, locked, busy, tap } = useTapped(checkout.running || actions.running);
  const reload = () => { entitlements.reload(); products.reload(); };

  return (
    <ManageStackScreen title="Marketing plan" loading={entitlements.loading || products.loading} error={entitlements.error ?? products.error} onRetry={reload} onRefresh={reload}>
      {e ? (
        <>
          {e.trial.available ? <TrialCard trial={e.trial} canBuy={canBuy} busy={busy("trial")} locked={locked} onStart={tap("trial", actions.startTrial)} /> : null}
          <CurrentPlanCard
            e={e} canBuy={canBuy} busy={busy("renewal")} locked={locked}
            onCancelRenewal={() => { setTapped("renewal"); return actions.cancelRenewal(); }}
            onResume={tap("renewal", () => renewingPlan && e.subscription && checkout.subscribe(renewingPlan, e.subscription.interval))}
          />
          <UsageCard e={e} />
          {canBuy ? null : <Text style={styles.note}>Only the owner can buy</Text>}
          <Text style={styles.note}>{UPGRADE_NOTE}</Text>
          <SegmentedTabs options={INTERVAL_OPTIONS} value={interval} onChange={setPickedInterval} />
          {plans.map((p) => (
            <PlanCard key={p.id} product={p} currentProduct={plans.find((c) => c.id === e.plan?.id)} interval={interval} e={e} canBuy={canBuy} busy={busy(p.id)} locked={locked} onBuy={tap(p.id, () => checkout.subscribe(p, interval))} />
          ))}
          {topUp ? <TopUpCard onPaidPlan={e.onPaidPlan} product={topUp} quantity={quantity} onQuantity={setQuantity} canBuy={canBuy} busy={busy(topUp.id)} locked={locked} onBuy={tap(topUp.id, () => checkout.buy(topUp.id, quantity))} /> : null}
          {packs.length > 0 ? (
            <ImagePacksCard packs={packs} canBuy={canBuy} pendingId={locked ? tapped : null} locked={locked} onBuy={(p) => tap(p.id, () => checkout.buy(p.id, 1))()} />
          ) : null}
          <SectionCard flush>
            {LINKS.map((l) => <ListRow key={l.title} title={l.title} subtitle={l.subtitle} icon={l.icon} chevron onPress={() => router.push(l.href)} />)}
          </SectionCard>
        </>
      ) : null}
      <PlanPayment checkout={checkout} description="Marketing" />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  packNote: { paddingHorizontal: 0, marginBottom: 12 },
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
});
