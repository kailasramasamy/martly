import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { formatDate } from "../ui/dates";
import { formatINR, manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";
import { TONES } from "./common";
import type { AdProduct, BillingInterval, Entitlements } from "./plan-types";

const MIN_QTY = 1;
const MAX_QTY = 12;

export function UsageCard({ e }: { e: Entitlements }) {
  const { promotions, aiImages } = e;
  return (
    <SectionCard title="This month">
      <KeyValue label="Promotions left" value={`${promotions.planLeft} of ${promotions.planTotal}`} />
      <KeyValue label="Extra promotions" value={promotions.topUpBalance} />
      <KeyValue label="AI images" value={`${aiImages.used} of ${aiImages.total} used`} />
      {aiImages.packBalance > 0 ? <KeyValue label="AI images from packs" value={`+${aiImages.packBalance}`} /> : null}
      <KeyValue label="Push notifications" value={e.pushIncluded ? "Included" : "Not included"} />
      {promotions.resetsAt ? <Text style={styles.muted}>{`Promotions reset on ${formatDate(promotions.resetsAt)}`}</Text> : null}
      {aiImages.resetsAt ? <Text style={styles.muted}>{`Plan AI images reset on ${formatDate(aiImages.resetsAt)}`}</Text> : null}
    </SectionCard>
  );
}

function features(p: AdProduct): string[] {
  return [
    `${p.promotionCredits} promotions a month`,
    `${p.aiImagesPerMonth} AI images a month`,
    ...(p.pushIncluded ? ["Push notifications to customers"] : []),
  ];
}

/** This plan is the one renewing itself (auto-renew on) at this billing interval */
const isAutoRenewing = (e: Entitlements, product: AdProduct, interval: BillingInterval) =>
  e.subscription?.productCode === product.code && e.subscription.interval === interval && e.subscription.status === "ACTIVE" && !e.subscription.cancelAtPeriodEnd;

/** What a plan costs per month at an interval; annual plans without a yearly price fall back to monthly */
const monthlyEquivalent = (product: AdProduct, interval: BillingInterval) =>
  interval === "YEARLY" && product.yearlyPrice !== null ? product.yearlyPrice / 12 : product.price;

function actionLabel(product: AdProduct, currentProduct: AdProduct | undefined, interval: BillingInterval, e: Entitlements): string {
  if (!e.plan || !currentProduct) return "Get plan";
  if (e.plan.id === product.id && e.subscription?.interval === interval) return isAutoRenewing(e, product, interval) ? "Current plan" : "Renew automatically";
  const current = monthlyEquivalent(currentProduct, e.plan.billingInterval);
  return monthlyEquivalent(product, interval) > current ? "Upgrade" : "Switch at end of current plan";
}

function PriceBlock({ product, interval }: { product: AdProduct; interval: BillingInterval }) {
  const gst = `+ ${product.gstPercent}% GST`;
  if (interval === "MONTHLY") {
    return (
      <>
        <Text style={styles.price}>{formatINR(product.price)}<Text style={styles.muted}>{` / month ${gst}`}</Text></Text>
        {product.price > 0 ? <Text style={styles.muted}>Renews monthly · cancel anytime</Text> : null}
      </>
    );
  }
  if (product.price === 0) return <Text style={styles.price}>{formatINR(0)}</Text>;
  if (product.yearlyPrice === null) return <Text style={styles.muted}>Monthly only</Text>;
  return (
    <>
      <Text style={styles.price}>{formatINR(Math.round(product.yearlyPrice / 12))}<Text style={styles.muted}> / month</Text></Text>
      <Text style={styles.muted}>{`Billed ${formatINR(product.yearlyPrice)} a year ${gst} · save ${formatINR(product.price * 12 - product.yearlyPrice)}`}</Text>
      <Text style={styles.muted}>Renews yearly · cancel anytime</Text>
    </>
  );
}

interface PlanCardProps {
  product: AdProduct;
  currentProduct: AdProduct | undefined;
  interval: BillingInterval;
  e: Entitlements;
  canBuy: boolean;
  busy: boolean;
  /** Another purchase is running: this one waits, without spinning */
  locked: boolean;
  onBuy: () => void;
}

export function PlanCard({ product, currentProduct, interval, e, canBuy, busy, locked, onBuy }: PlanCardProps) {
  const current = e.plan?.id === product.id && (product.price === 0 || e.subscription?.interval === interval);
  const unavailable = interval === "YEARLY" && product.yearlyPrice === null;
  return (
    <SectionCard>
      <View style={styles.planHead}>
        <Text style={styles.planName}>{product.name}</Text>
        {current ? <StatusPill label="Current" {...TONES.green} /> : null}
      </View>
      <PriceBlock product={product} interval={interval} />
      {features(product).map((f) => (
        <View key={f} style={styles.feature}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}
      {product.price > 0 ? (
        <Button label={actionLabel(product, currentProduct, interval, e)} onPress={onBuy} disabled={!canBuy || locked || unavailable || isAutoRenewing(e, product, interval)} loading={busy} variant={current ? "secondary" : "primary"} style={styles.buy} />
      ) : (
        <Text style={[styles.muted, styles.buy]}>You're on this plan whenever no paid plan is running.</Text>
      )}
    </SectionCard>
  );
}

interface TopUpProps {
  onPaidPlan: boolean;
  product: AdProduct;
  quantity: number;
  onQuantity: (n: number) => void;
  canBuy: boolean;
  busy: boolean;
  /** Another purchase is running: this one waits, without spinning */
  locked: boolean;
  onBuy: () => void;
  /** Set when the ledger balance covers the total */
  onBuyFromBalance?: () => void;
}

export function TopUpCard({ onPaidPlan, product, quantity, onQuantity, canBuy, busy, locked, onBuy, onBuyFromBalance }: TopUpProps) {
  return (
    <SectionCard title="Extra promotions">
      <Text style={styles.muted}>{`${formatINR(product.price)} each + ${product.gstPercent}% GST. Used after your monthly promotions run out; they never expire.`}</Text>
      <View style={styles.stepper}>
        <StepButton icon="remove" label="Fewer" disabled={quantity <= MIN_QTY} onPress={() => onQuantity(quantity - 1)} />
        <Text style={styles.qty}>{quantity}</Text>
        <StepButton icon="add" label="More" disabled={quantity >= MAX_QTY} onPress={() => onQuantity(quantity + 1)} />
      </View>
      <Button label={`Buy ${quantity} for ${formatINR(product.price * quantity)}`} onPress={onBuy} disabled={!canBuy || locked || !onPaidPlan} loading={busy} style={styles.buy} />
      {onBuyFromBalance ? <Button label="Pay from balance" icon="wallet-outline" variant="secondary" onPress={onBuyFromBalance} disabled={!canBuy || locked || !onPaidPlan} style={styles.buy} /> : null}
      {onPaidPlan ? null : <Text style={styles.muted}>Extra promotions are available on Growth and Pro</Text>}
    </SectionCard>
  );
}

function StepButton({ icon, label, disabled, onPress }: { icon: "add" | "remove"; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.step, disabled && styles.stepOff]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  planHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  price: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary, marginVertical: 8 },
  feature: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  featureText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  buy: { marginTop: 12 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 12 },
  step: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepOff: { opacity: 0.4 },
  qty: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, minWidth: 32, textAlign: "center" },
});
