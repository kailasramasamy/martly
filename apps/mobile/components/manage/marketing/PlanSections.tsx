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
import type { AdProduct, Entitlements } from "./plan-types";

const MIN_QTY = 1;
const MAX_QTY = 12;

export function CurrentPlanCard({ e }: { e: Entitlements }) {
  const paidThrough = e.paidThrough ? `Paid through ${formatDate(e.paidThrough)}` : "Free plan";
  return (
    <SectionCard title="Your plan">
      <Text style={styles.planName}>{e.plan?.name ?? "Free"}</Text>
      <Text style={styles.muted}>{paidThrough}</Text>
    </SectionCard>
  );
}

export function UsageCard({ e }: { e: Entitlements }) {
  const { bannerSlots, promotions, aiImages } = e;
  return (
    <SectionCard title="This month">
      <KeyValue label="Banner slots" value={bannerSlots.total === null ? `${bannerSlots.used} used, unlimited` : `${bannerSlots.used} of ${bannerSlots.total} used`} />
      <KeyValue label="Promotions left" value={`${promotions.planLeft} of ${promotions.planTotal}`} />
      <KeyValue label="Extra promotions" value={promotions.topUpBalance} />
      <KeyValue label="AI banner images" value={`${aiImages.used} of ${aiImages.total} used`} />
      <KeyValue label="Push notifications" value={e.pushIncluded ? "Included" : "Not included"} />
      {promotions.resetsAt ? <Text style={styles.muted}>{`Promotions reset on ${formatDate(promotions.resetsAt)}`}</Text> : null}
    </SectionCard>
  );
}

function features(p: AdProduct): string[] {
  return [
    p.bannerSlots === null ? "Unlimited banners" : `${p.bannerSlots} banner slots`,
    `${p.promotionCredits} AI promotions a month`,
    `${p.aiImagesPerMonth} AI banner images a month`,
    ...(p.pushIncluded ? ["Push notifications to customers"] : []),
  ];
}

function actionLabel(product: AdProduct, e: Entitlements): string {
  if (!e.plan) return "Get plan";
  if (e.plan.id === product.id) return "Renew";
  return product.price > e.plan.price ? "Upgrade" : "Switch plan";
}

interface PlanCardProps {
  product: AdProduct;
  e: Entitlements;
  canBuy: boolean;
  busy: boolean;
  onBuy: () => void;
}

export function PlanCard({ product, e, canBuy, busy, onBuy }: PlanCardProps) {
  const current = e.plan?.id === product.id;
  return (
    <SectionCard>
      <View style={styles.planHead}>
        <Text style={styles.planName}>{product.name}</Text>
        {current ? <StatusPill label="Current" {...TONES.green} /> : null}
      </View>
      <Text style={styles.price}>{formatINR(product.price)}<Text style={styles.muted}>{` / month + ${product.gstPercent}% GST`}</Text></Text>
      {features(product).map((f) => (
        <View key={f} style={styles.feature}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}
      {product.price > 0 ? (
        <Button label={actionLabel(product, e)} onPress={onBuy} disabled={!canBuy} loading={busy} variant={current ? "secondary" : "primary"} style={styles.buy} />
      ) : (
        <Text style={[styles.muted, styles.buy]}>You're on this plan whenever no paid plan is running.</Text>
      )}
    </SectionCard>
  );
}

interface TopUpProps {
  product: AdProduct;
  quantity: number;
  onQuantity: (n: number) => void;
  canBuy: boolean;
  busy: boolean;
  onBuy: () => void;
}

export function TopUpCard({ product, quantity, onQuantity, canBuy, busy, onBuy }: TopUpProps) {
  return (
    <SectionCard title="Extra promotions">
      <Text style={styles.muted}>{`${formatINR(product.price)} each + ${product.gstPercent}% GST. Used after your monthly promotions run out; they never expire.`}</Text>
      <View style={styles.stepper}>
        <StepButton icon="remove" label="Fewer" disabled={quantity <= MIN_QTY} onPress={() => onQuantity(quantity - 1)} />
        <Text style={styles.qty}>{quantity}</Text>
        <StepButton icon="add" label="More" disabled={quantity >= MAX_QTY} onPress={() => onQuantity(quantity + 1)} />
      </View>
      <Button label={`Buy ${quantity} for ${formatINR(product.price * quantity)}`} onPress={onBuy} disabled={!canBuy} loading={busy} style={styles.buy} />
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
