import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../lib/toast-context";
import { colors, spacing, fontSize } from "../constants/theme";
import { RazorpayCheckout } from "../components/RazorpayCheckout";
import type { MembershipPlan, UserMembership, MembershipUpgradeOption } from "../lib/types";

const PURPLE = "#7c3aed";
const PURPLE_LIGHT = "#a78bfa";
const PURPLE_DARK = "#5b21b6";

const DURATION_SUFFIX: Record<string, string> = {
  MONTHLY: "/month",
  QUARTERLY: "/quarter",
  ANNUAL: "/year",
};

const DURATION_LABEL: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

const DURATION_COLOR: Record<string, string> = {
  MONTHLY: "#3b82f6",
  QUARTERLY: "#8b5cf6",
  ANNUAL: "#d97706",
};

export default function MembershipScreen() {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const { show } = useToast();
  const storeId = selectedStore?.id;

  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [activeMembership, setActiveMembership] = useState<UserMembership | null>(null);
  const [upgradeOptions, setUpgradeOptions] = useState<MembershipUpgradeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // Razorpay state
  const [rpVisible, setRpVisible] = useState(false);
  const [rpData, setRpData] = useState<{
    orderId: string; amount: number; currency: string; keyId: string;
    planId: string; customerId?: string;
    previousMembershipId?: string; amountPaid?: number;
  } | null>(null);

  const fetchData = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    try {
      const res = await api.get<{ plans: MembershipPlan[]; activeMembership: UserMembership | null; upgradeOptions: MembershipUpgradeOption[] }>(`/api/v1/memberships?storeId=${storeId}`);
      setPlans(res.data.plans);
      setActiveMembership(res.data.activeMembership);
      setUpgradeOptions(res.data.upgradeOptions ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const handlePurchase = async (plan: MembershipPlan) => {
    if (!storeId) return;
    setPurchasing(plan.id);
    try {
      const res = await api.post<{ razorpay_order_id: string; amount: number; currency: string; key_id: string; planId: string; customer_id?: string }>(
        "/api/v1/memberships/purchase",
        { planId: plan.id, storeId },
      );
      setRpData({
        orderId: res.data.razorpay_order_id,
        amount: res.data.amount,
        currency: res.data.currency,
        keyId: res.data.key_id,
        planId: res.data.planId,
        customerId: res.data.customer_id,
      });
      setRpVisible(true);
    } catch {
      show("Failed to initiate payment", "error");
    } finally {
      setPurchasing(null);
    }
  };

  const handlePaymentSuccess = async (data: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
    setRpVisible(false);
    try {
      let verifyUrl = `/api/v1/memberships/verify?planId=${rpData?.planId}`;
      if (rpData?.previousMembershipId) {
        verifyUrl += `&previousMembershipId=${rpData.previousMembershipId}&amountPaid=${rpData.amountPaid}`;
      }
      await api.post(verifyUrl, {
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
      });
      show(rpData?.previousMembershipId ? "Plan upgraded successfully!" : "Welcome to Mart Plus!", "success");
      fetchData();
    } catch {
      show("Payment verified but activation failed. Contact support.", "error");
    }
  };

  const handleUpgrade = async (option: MembershipUpgradeOption) => {
    if (!storeId) return;
    setUpgrading(option.plan.id);
    try {
      const res = await api.post<{
        upgraded: boolean;
        membership?: UserMembership;
        razorpay_order_id?: string;
        amount?: number;
        currency?: string;
        key_id?: string;
        planId?: string;
        previousMembershipId?: string;
        amountPaid?: number;
        customer_id?: string;
      }>("/api/v1/memberships/upgrade", { planId: option.plan.id, storeId });

      if (res.data.upgraded) {
        show("Plan upgraded successfully!", "success");
        fetchData();
      } else {
        setRpData({
          orderId: res.data.razorpay_order_id!,
          amount: res.data.amount!,
          currency: res.data.currency!,
          keyId: res.data.key_id!,
          planId: res.data.planId!,
          customerId: res.data.customer_id,
          previousMembershipId: res.data.previousMembershipId,
          amountPaid: res.data.amountPaid,
        });
        setRpVisible(true);
      }
    } catch {
      show("Failed to initiate upgrade", "error");
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PURPLE} />
      </View>
    );
  }

  const daysLeft = activeMembership
    ? Math.max(0, Math.ceil((new Date(activeMembership.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={PURPLE} />}
      >
        {activeMembership ? (
          /* ── Active Member State ─────────────────── */
          <>
            <LinearGradient
              colors={[PURPLE_DARK, PURPLE, PURPLE_LIGHT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.memberCard}
            >
              <View style={styles.memberCardInner}>
                <View style={styles.memberBadge}>
                  <Ionicons name="diamond" size={20} color="#fbbf24" />
                  <Text style={styles.memberBadgeText}>MART PLUS</Text>
                </View>
                <Text style={styles.memberPlan}>{activeMembership.plan.name}</Text>
                <Text style={styles.memberExpiry}>
                  Valid until {new Date(activeMembership.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </Text>
                <View style={styles.daysChip}>
                  <Text style={styles.daysChipText}>{daysLeft} days left</Text>
                </View>
              </View>
              {/* Decorative circles */}
              <View style={[styles.decorCircle, { top: -20, right: -20, opacity: 0.1 }]} />
              <View style={[styles.decorCircle, { bottom: -30, left: -10, width: 80, height: 80, opacity: 0.08 }]} />
            </LinearGradient>

            <View style={styles.benefitsCard}>
              <Text style={styles.benefitsTitle}>Your Benefits</Text>
              {activeMembership.plan.freeDelivery && (
                <BenefitRow icon="car-outline" text="Free delivery on all orders" />
              )}
              {activeMembership.plan.loyaltyMultiplier > 1 && (
                <BenefitRow icon="star-outline" text={`${activeMembership.plan.loyaltyMultiplier}x loyalty points on every order`} />
              )}
              <BenefitRow icon="pricetag-outline" text="Exclusive member prices on select items" />
              <BenefitRow icon="flash-outline" text="Priority order processing" />
            </View>

            {upgradeOptions.length > 0 && (
              <>
                <Text style={styles.upgradeSectionTitle}>Upgrade Your Plan</Text>
                {upgradeOptions.map((option) => (
                  <View key={option.plan.id} style={styles.upgradeCard}>
                    <View style={styles.planHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.planName}>{option.plan.name}</Text>
                      </View>
                      <View style={[styles.durationTag, { backgroundColor: `${DURATION_COLOR[option.plan.duration] ?? PURPLE}18` }]}>
                        <Text style={[styles.durationTagText, { color: DURATION_COLOR[option.plan.duration] ?? PURPLE }]}>
                          {DURATION_LABEL[option.plan.duration]}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.upgradePricing}>
                      <Text style={styles.upgradeOriginal}>{"\u20B9"}{option.plan.price}</Text>
                      {option.isFree ? (
                        <Text style={styles.upgradeFree}>FREE</Text>
                      ) : (
                        <Text style={styles.upgradeCharge}>{"\u20B9"}{option.upgradeCharge}</Text>
                      )}
                    </View>

                    <View style={styles.creditRow}>
                      <Ionicons name="gift-outline" size={14} color="#16a34a" />
                      <Text style={styles.creditText}>{"\u20B9"}{option.credit} credit from current plan</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.upgradeBtn}
                      onPress={() => handleUpgrade(option)}
                      disabled={!!upgrading}
                      activeOpacity={0.8}
                    >
                      {upgrading === option.plan.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.upgradeBtnText}>
                          {option.isFree ? "Upgrade Free" : `Upgrade \u2022 \u20B9${option.upgradeCharge}`}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        ) : (
          /* ── No Membership State ─────────────────── */
          <>
            <View style={styles.hero}>
              <View style={styles.heroIconWrap}>
                <LinearGradient
                  colors={[PURPLE, PURPLE_LIGHT]}
                  style={styles.heroIconGradient}
                >
                  <Ionicons name="diamond" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.heroTitle}>Mart Plus</Text>
              <Text style={styles.heroSubtitle}>
                Free delivery, bonus loyalty points, and exclusive member prices on every order.
              </Text>
            </View>

            {plans.map((plan) => (
              <View key={plan.id} style={styles.planCard}>
                <View style={styles.planHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {plan.description ? <Text style={styles.planDesc}>{plan.description}</Text> : null}
                  </View>
                  <View style={[styles.durationTag, { backgroundColor: `${DURATION_COLOR[plan.duration] ?? PURPLE}18` }]}>
                    <Text style={[styles.durationTagText, { color: DURATION_COLOR[plan.duration] ?? PURPLE }]}>
                      {DURATION_LABEL[plan.duration]}
                    </Text>
                  </View>
                </View>

                <View style={styles.planPrice}>
                  <Text style={styles.planPriceAmount}>{"\u20B9"}{plan.price}</Text>
                  <Text style={styles.planPriceSuffix}>{DURATION_SUFFIX[plan.duration]}</Text>
                </View>

                <View style={styles.planBenefits}>
                  {plan.freeDelivery && <MiniPerk icon="car-outline" text="Free delivery" />}
                  {plan.loyaltyMultiplier > 1 && <MiniPerk icon="star-outline" text={`${plan.loyaltyMultiplier}x points`} />}
                  <MiniPerk icon="pricetag-outline" text="Member prices" />
                </View>

                <TouchableOpacity
                  style={styles.subscribeBtn}
                  onPress={() => handlePurchase(plan)}
                  disabled={!!purchasing}
                  activeOpacity={0.8}
                >
                  {purchasing === plan.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.subscribeBtnText}>Subscribe</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}

            {plans.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="diamond-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No membership plans available for this store yet.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {rpData && (
        <RazorpayCheckout
          visible={rpVisible}
          keyId={rpData.keyId}
          orderId={rpData.orderId}
          amount={rpData.amount}
          currency={rpData.currency}
          customerId={rpData.customerId}
          name="Mart Plus Membership"
          description="Membership subscription"
          prefill={{ email: user?.email, name: user?.name, contact: user?.phone ?? undefined }}
          onSuccess={handlePaymentSuccess}
          onCancel={() => { setRpVisible(false); show("Payment cancelled", "error"); }}
        />
      )}
    </View>
  );
}

function BenefitRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitCheck}>
        <Ionicons name="checkmark" size={14} color="#fff" />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

function MiniPerk({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.miniPerk}>
      <Ionicons name={icon as never} size={14} color={PURPLE} />
      <Text style={styles.miniPerkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },

  // ── Active member card ────────────────
  memberCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  memberCardInner: {
    zIndex: 1,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  memberBadgeText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  memberPlan: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  memberExpiry: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginBottom: 12,
  },
  daysChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  daysChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  decorCircle: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
  },

  // ── Benefits card ─────────────────────
  benefitsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 14,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  benefitCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#16a34a",
    justifyContent: "center",
    alignItems: "center",
  },
  benefitText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },

  // ── Upgrade section ──────────────────
  upgradeSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
    marginTop: 4,
  },
  upgradeCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: PURPLE_LIGHT,
  },
  upgradePricing: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8,
  },
  upgradeOriginal: {
    fontSize: 16,
    color: colors.textSecondary,
    textDecorationLine: "line-through",
  },
  upgradeCharge: {
    fontSize: 24,
    fontWeight: "800",
    color: PURPLE,
  },
  upgradeFree: {
    fontSize: 24,
    fontWeight: "800",
    color: "#16a34a",
  },
  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  creditText: {
    fontSize: 13,
    color: "#16a34a",
    fontWeight: "500",
  },
  upgradeBtn: {
    backgroundColor: PURPLE,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  upgradeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Hero (no membership) ──────────────
  hero: {
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 8,
  },
  heroIconWrap: {
    marginBottom: 14,
  },
  heroIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: PURPLE_DARK,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // ── Plan card ─────────────────────────
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  planName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  planDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  durationTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  durationTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  planPrice: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  planPriceAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: PURPLE,
  },
  planPriceSuffix: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 2,
  },
  planBenefits: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  miniPerk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${PURPLE}0a`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  miniPerkText: {
    fontSize: 12,
    color: PURPLE_DARK,
    fontWeight: "500",
  },
  subscribeBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  subscribeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Empty state ───────────────────────
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
