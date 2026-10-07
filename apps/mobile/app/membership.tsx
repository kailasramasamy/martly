import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../lib/store-context";
import { useAuth } from "../lib/auth-context";
import { useMartPlus } from "../lib/use-mart-plus";
import { colors, fonts, spacing } from "../constants/theme";
import { RazorpayCheckout } from "../components/RazorpayCheckout";
import { PlusHero } from "../components/membership/PlusHero";
import { PlanCard, perMonth } from "../components/membership/PlanCard";
import { MemberCard } from "../components/membership/MemberCard";
import { UpgradeCard } from "../components/membership/UpgradeCard";
import type { MembershipPlan } from "../lib/types";

function PlanChooser({ plans, busyPlanId, onSubscribe }: {
  plans: MembershipPlan[]; busyPlanId: string | null; onSubscribe: (plan: MembershipPlan) => void;
}) {
  if (plans.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="diamond-outline" size={44} color={colors.textSecondary} />
        <Text style={styles.emptyText}>No membership plans available for this store yet.</Text>
      </View>
    );
  }
  const monthlyPrice = plans.find((p) => p.duration === "MONTHLY")?.price;
  const best = plans.length > 1 ? plans.reduce((a, b) => (perMonth(b) < perMonth(a) ? b : a)) : null;
  return (
    <>
      <PlusHero maxPointsMultiplier={Math.max(...plans.map((p) => p.loyaltyMultiplier))} />
      <Text style={styles.sectionTitle}>Choose your plan</Text>
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          monthlyPrice={monthlyPrice != null ? Number(monthlyPrice) : undefined}
          bestValue={plan.id === best?.id}
          busy={busyPlanId === plan.id}
          disabled={busyPlanId !== null}
          onSubscribe={onSubscribe}
        />
      ))}
    </>
  );
}

export default function MembershipScreen() {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const plus = useMartPlus(selectedStore?.id);

  if (plus.loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={plus.refreshing} onRefresh={plus.refresh} tintColor={colors.primary} />}
      >
        {plus.activeMembership ? (
          <>
            <MemberCard membership={plus.activeMembership} />
            {plus.upgradeOptions.length > 0 && <Text style={styles.sectionTitle}>Upgrade your plan</Text>}
            {plus.upgradeOptions.map((option) => (
              <UpgradeCard
                key={option.plan.id}
                option={option}
                busy={plus.busyPlanId === option.plan.id}
                disabled={plus.busyPlanId !== null}
                onUpgrade={plus.upgrade}
              />
            ))}
          </>
        ) : (
          <PlanChooser plans={plus.plans} busyPlanId={plus.busyPlanId} onSubscribe={plus.purchase} />
        )}
      </ScrollView>

      {plus.rpData && (
        <RazorpayCheckout
          visible
          keyId={plus.rpData.keyId}
          orderId={plus.rpData.orderId}
          amount={plus.rpData.amount}
          currency={plus.rpData.currency}
          customerId={plus.rpData.customerId}
          name="Mart Plus Membership"
          description="Membership subscription"
          prefill={{ email: user?.email, name: user?.name, contact: user?.phone ?? undefined }}
          onSuccess={plus.onPaymentSuccess}
          onCancel={plus.onPaymentCancel}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, marginTop: 8, marginBottom: 14 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary, textAlign: "center" },
});
