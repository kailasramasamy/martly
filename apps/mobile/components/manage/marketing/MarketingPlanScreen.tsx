import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { LISTING_FEE } from "@martly/shared/constants";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { formatINR } from "../ui/tokens";
import { ListRow } from "../ui/ListRow";
import { api } from "../../../lib/api";
import { useResource } from "../../../lib/manage/use-resource";
import { useAuth } from "../../../lib/auth-context";
import { colors, fonts } from "../../../constants/theme";
import { PlanPayment } from "./PlanPayment";
import { CurrentPlanCard } from "./CurrentPlanCard";
import { TopUpCard } from "./PlanSections";
import { PlanCard } from "./PlanCard";
import { useAdCheckout } from "./use-ad-checkout";
import { usePlanActions } from "./use-plan-actions";
import { useEntitlements } from "./use-entitlements";
import { useBalance } from "./use-balance";
import type { AdProduct, BillingInterval } from "./plan-types";

const PLAN_NOTE = `Prices plus 18% GST. Each own or local product beyond your plan's free listings is \u20B9${LISTING_FEE}, one-time, and stays listed if you change plans. Upgrades start now and unused days carry over.`;

const LINKS = [
  { title: "Results", subtitle: "Views, taps and orders from the last 30 days", icon: "stats-chart-outline", href: "/manage/marketing-plan/results" },
  { title: "Invoices", subtitle: "Receipts for what you've bought", icon: "receipt-outline", href: "/manage/marketing-plan/invoices" },
  { title: "Billing details", subtitle: "Name, GSTIN and address on invoices", icon: "business-outline", href: "/manage/marketing-plan/billing" },
] as const;

function splitProducts(products: AdProduct[] | null) {
  const all = products ?? [];
  return { plans: all.filter((p) => p.kind === "STORE_PLAN"), topUp: all.find((p) => p.kind === "PROMOTION_TOPUP"), listingTopUp: all.find((p) => p.kind === "LISTING_TOPUP") };
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
  const balance = useBalance(can(user, "marketing-plan", "create"));
  const checkout = useAdCheckout(() => { entitlements.reload(); balance.reload(); });
  const actions = usePlanActions(entitlements.reload);
  const [quantity, setQuantity] = useState(1);
  const [listingQuantity, setListingQuantity] = useState(1);
  const canBuy = can(user, "marketing-plan", "create");
  const e = entitlements.data;
  const { plans, topUp, listingTopUp } = splitProducts(products.data);
  // Turning auto-renew back on buys the plan that was renewing again, from the end of the paid time
  const renewingPlan = plans.find((p) => p.code === e?.subscription?.productCode);
  const { setTapped, locked, busy, tap } = useTapped(checkout.running || actions.running);
  const reload = () => { entitlements.reload(); products.reload(); };

  return (
    <ManageStackScreen title="Marketing plan" loading={entitlements.loading || products.loading} error={entitlements.error ?? products.error} onRetry={reload} onRefresh={reload}>
      {e ? (
        <>
          <CurrentPlanCard
            e={e} canBuy={canBuy} busy={busy("renewal")} locked={locked}
            onCancelRenewal={() => { setTapped("renewal"); return actions.cancelRenewal(); }}
            onResume={tap("renewal", () => renewingPlan && e.subscription && checkout.subscribe(renewingPlan, e.subscription.interval))}
          />
          {canBuy ? null : <Text style={styles.note}>Only the owner can buy</Text>}
          {plans.map((p) => (
            <PlanCard
              key={p.id} product={p} currentProduct={plans.find((c) => c.id === e.plan?.id)} e={e} canBuy={canBuy} locked={locked}
              busyInterval={(["MONTHLY", "YEARLY"] as const).find((i) => busy(`${p.id}:${i}`)) ?? null}
              onBuy={(i: BillingInterval) => tap(`${p.id}:${i}`, () => checkout.subscribe(p, i))()}
            />
          ))}
          <Text style={styles.note}>{PLAN_NOTE}</Text>
          {topUp ? (
            <TopUpCard
              title="Extra promotions" description={`${formatINR(topUp.price)} each + ${topUp.gstPercent}% GST. Used after your monthly promotions run out; they never expire.`}
              product={topUp} quantity={quantity} onQuantity={setQuantity} canBuy={canBuy} busy={busy(topUp.id)} locked={locked}
              onBuy={tap(topUp.id, () => checkout.buy(topUp.id, quantity))}
              onBuyFromBalance={balance.covers(topUp, quantity) ? tap(topUp.id, () => checkout.buyFromBalance(topUp.id, quantity)) : undefined}
            />
          ) : null}
          {listingTopUp ? (
            <TopUpCard
              title="Your own products"
              status={e.listings.unlimited ? "Unlimited own products, set by Martly" : `${e.listings.used} of ${e.listings.included} free listings used \u00B7 ${e.listings.extraBalance} extra left`}
              description={`${formatINR(listingTopUp.price)} each + ${listingTopUp.gstPercent}% GST for your own or local products beyond your plan's free listings. One-time; they never expire.`}
              product={listingTopUp} quantity={listingQuantity} onQuantity={setListingQuantity} canBuy={canBuy} busy={busy(listingTopUp.id)} locked={locked}
              onBuy={tap(listingTopUp.id, () => checkout.buy(listingTopUp.id, listingQuantity))}
              onBuyFromBalance={balance.covers(listingTopUp, listingQuantity) ? tap(listingTopUp.id, () => checkout.buyFromBalance(listingTopUp.id, listingQuantity)) : undefined}
            />
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
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
});
