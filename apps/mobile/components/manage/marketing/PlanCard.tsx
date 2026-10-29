import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { formatINR } from "../ui/tokens";
import { CATALOG_SIZE_LABEL, OWN_LISTINGS_INCLUDED } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import type { AdProduct, BillingInterval, Entitlements } from "./plan-types";

const WEB_STORE = "Web store on martlyshop.in";
const NOTIFICATIONS = "Offer notifications to your customers";

function features(p: AdProduct): { included: string[]; missing: string[] } {
  const listings = [`${CATALOG_SIZE_LABEL} catalog products listed free`, `${OWN_LISTINGS_INCLUDED[p.code] ?? 0} of your own or local products listed free`];
  if (p.price === 0) return { included: ["Your store on the Martly app", ...listings, "Buy extra promotions any time"], missing: [WEB_STORE, NOTIFICATIONS] };
  return { included: ["Your store on the Martly app", ...listings, WEB_STORE, ...(p.pushIncluded ? [NOTIFICATIONS] : [])], missing: [] };
}

/** This plan is the one renewing itself (auto-renew on) at this billing interval */
const isAutoRenewing = (e: Entitlements, product: AdProduct, interval: BillingInterval) =>
  e.subscription?.productCode === product.code && e.subscription.interval === interval && e.subscription.status === "ACTIVE" && !e.subscription.cancelAtPeriodEnd;

/** What a plan costs per month at an interval; annual plans without a yearly price fall back to monthly */
const monthlyEquivalent = (product: AdProduct, interval: BillingInterval) =>
  interval === "YEARLY" && product.yearlyPrice !== null ? product.yearlyPrice / 12 : product.price;

function actionLabel(product: AdProduct, currentProduct: AdProduct | undefined, interval: BillingInterval, e: Entitlements): string {
  const price = interval === "YEARLY" ? `${formatINR(product.yearlyPrice ?? 0)} a year` : `${formatINR(product.price)} a month`;
  if (!e.plan || !currentProduct || currentProduct.price === 0) return `Pay ${price}`;
  if (e.plan.id === product.id && e.subscription?.interval === interval) return isAutoRenewing(e, product, interval) ? "Your current plan" : `Renew automatically · ${price}`;
  const verb = monthlyEquivalent(product, interval) > monthlyEquivalent(currentProduct, e.plan.billingInterval) ? "Upgrade" : "Switch after current plan";
  return `${verb} · ${price}`;
}

function Ticks({ items, missing }: { items: string[]; missing?: boolean }) {
  return items.map((f) => (
    <View key={f} style={styles.feature}>
      <Ionicons name={missing ? "close-circle" : "checkmark-circle"} size={16} color={missing ? "#94a3b8" : colors.primary} />
      <Text style={[styles.featureText, missing && styles.missing]}>{f}</Text>
    </View>
  ));
}

function AnnualStrip({ product }: { product: AdProduct }) {
  if (product.yearlyPrice === null || product.price === 0) return null;
  const freeMonths = Math.round((product.price * 12 - product.yearlyPrice) / product.price);
  return (
    <View style={styles.annual}>
      {freeMonths > 0 ? <Text style={styles.freePill}>{`${freeMonths} months free`}</Text> : null}
      <Text style={styles.annualText}>
        {`or ${formatINR(product.yearlyPrice)} a year`}
        <Text style={styles.annualSub}>{` · ${formatINR(Math.round(product.yearlyPrice / 12))}/month`}</Text>
      </Text>
    </View>
  );
}

interface PlanCardProps {
  product: AdProduct;
  currentProduct: AdProduct | undefined;
  e: Entitlements;
  canBuy: boolean;
  /** The interval whose button was tapped, while its purchase runs */
  busyInterval: BillingInterval | null;
  /** Another purchase is running: this one waits, without spinning */
  locked: boolean;
  onBuy: (interval: BillingInterval) => void;
}

export function PlanCard({ product, currentProduct, e, canBuy, busyInterval, locked, onBuy }: PlanCardProps) {
  const current = e.plan?.id === product.id;
  const { included, missing } = features(product);
  const intervals: BillingInterval[] = product.yearlyPrice === null ? ["MONTHLY"] : ["YEARLY", "MONTHLY"];
  return (
    <SectionCard style={current ? styles.currentCard : undefined}>
      <View style={styles.head}>
        <Text style={styles.name}>{product.name}</Text>
        {current ? <Text style={styles.currentPill}>Your plan</Text> : null}
      </View>
      <Text style={styles.price}>{formatINR(product.price)}<Text style={styles.per}> / month</Text></Text>
      <AnnualStrip product={product} />
      <View style={styles.promos}>
        <Text style={styles.promoCount}>{product.promotionCredits}</Text>
        <Text style={styles.promoLabel}>{product.promotionCredits > 0 ? "promotions a month" : "promotions"}</Text>
      </View>
      <Ticks items={included} />
      <Ticks items={missing} missing />
      {product.price > 0 ? intervals.map((interval, i) => {
        const renewing = isAutoRenewing(e, product, interval);
        return (
          <Button
            key={interval} label={actionLabel(product, currentProduct, interval, e)} onPress={() => onBuy(interval)}
            disabled={!canBuy || locked || renewing} loading={busyInterval === interval}
            variant={i === 0 && !renewing ? "primary" : "secondary"} style={i === 0 ? styles.firstBtn : styles.btn}
          />
        );
      }) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  currentCard: { borderWidth: 2, borderColor: colors.primary, backgroundColor: "#f0fdfa" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  currentPill: { fontFamily: fonts.bold, fontSize: 12, color: "#fff", backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  price: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, marginTop: 6 },
  per: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  annual: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 6 },
  freePill: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.salePillText, backgroundColor: colors.salePill, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden", textTransform: "uppercase", letterSpacing: 0.4 },
  annualText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  annualSub: { fontFamily: fonts.medium, color: colors.textSecondary },
  promos: { flexDirection: "row", alignItems: "baseline", gap: 8, backgroundColor: "#ccfbf1", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 12 },
  promoCount: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.primary },
  promoLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  feature: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  featureText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  missing: { color: colors.textSecondary },
  firstBtn: { marginTop: 14 },
  btn: { marginTop: 8 },
});
