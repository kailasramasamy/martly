import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
import { useToast } from "./toast-context";
import { useStrings } from "./i18n/use-strings";
import type { MembershipPlan, UserMembership, MembershipUpgradeOption } from "./types";

interface RazorpayData {
  orderId: string; amount: number; currency: string; keyId: string;
  planId: string; customerId?: string;
  previousMembershipId?: string;
}

interface PurchaseResponse {
  razorpay_order_id: string; amount: number; currency: string; key_id: string; planId: string; customer_id?: string;
}

interface UpgradeResponse extends Partial<PurchaseResponse> {
  upgraded: boolean; membership?: UserMembership; previousMembershipId?: string; amountPaid?: number;
}

type PaymentResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

const toRazorpayData = (r: Partial<PurchaseResponse>, extra?: Partial<RazorpayData>): RazorpayData => ({
  orderId: r.razorpay_order_id!, amount: r.amount!, currency: r.currency!, keyId: r.key_id!,
  planId: r.planId!, customerId: r.customer_id, ...extra,
});

async function requestPurchase(planId: string, storeId: string): Promise<RazorpayData> {
  const res = await api.post<PurchaseResponse>("/api/v1/memberships/purchase", { planId, storeId });
  return toRazorpayData(res.data);
}

// null when the upgrade was covered by existing credit and applied immediately
async function requestUpgrade(planId: string, storeId: string): Promise<RazorpayData | null> {
  const res = await api.post<UpgradeResponse>("/api/v1/memberships/upgrade", { planId, storeId });
  if (res.data.upgraded) return null;
  return toRazorpayData(res.data, { previousMembershipId: res.data.previousMembershipId });
}

async function verifyPayment(paid: RazorpayData, data: PaymentResult) {
  let verifyUrl = `/api/v1/memberships/verify?planId=${paid.planId}`;
  if (paid.previousMembershipId) {
    verifyUrl += `&previousMembershipId=${paid.previousMembershipId}`;
  }
  await api.post(verifyUrl, data);
}

function useMembershipData(storeId: string | undefined) {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [activeMembership, setActiveMembership] = useState<UserMembership | null>(null);
  const [upgradeOptions, setUpgradeOptions] = useState<MembershipUpgradeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    try {
      const res = await api.get<{ plans: MembershipPlan[]; activeMembership: UserMembership | null; upgradeOptions: MembershipUpgradeOption[] }>(`/api/v1/memberships?storeId=${storeId}`);
      setPlans(res.data.plans);
      setActiveMembership(res.data.activeMembership);
      setUpgradeOptions(res.data.upgradeOptions ?? []);
    } catch {
      // keep the last loaded state; pull to refresh retries
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const refresh = () => { setRefreshing(true); fetchData(); };
  return { plans, activeMembership, upgradeOptions, loading, refreshing, refresh, fetchData };
}

function useMembershipCheckout(storeId: string | undefined, onActivated: () => void) {
  const { show } = useToast();
  const t = useStrings("account").membership;
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [rpData, setRpData] = useState<RazorpayData | null>(null);

  const run = async (planId: string, start: () => Promise<RazorpayData | null>, failMsg: string) => {
    setBusyPlanId(planId);
    try {
      const payment = await start();
      if (payment) setRpData(payment);
      else { show(t.upgraded, "success"); onActivated(); }
    } catch {
      show(failMsg, "error");
    } finally {
      setBusyPlanId(null);
    }
  };

  const purchase = (plan: MembershipPlan) =>
    storeId && run(plan.id, () => requestPurchase(plan.id, storeId), t.paymentFailed);
  const upgrade = (option: MembershipUpgradeOption) =>
    storeId && run(option.plan.id, () => requestUpgrade(option.plan.id, storeId), t.upgradeFailed);

  const onPaymentSuccess = async (data: PaymentResult) => {
    const paid = rpData;
    setRpData(null);
    if (!paid) return;
    try {
      await verifyPayment(paid, data);
      show(paid.previousMembershipId ? t.upgraded : t.welcome, "success");
      onActivated();
    } catch {
      show(t.activationFailed, "error");
    }
  };

  const onPaymentCancel = () => { setRpData(null); show(t.paymentCancelled, "error"); };
  return { busyPlanId, rpData, purchase, upgrade, onPaymentSuccess, onPaymentCancel };
}

// Mart Plus plans, the user's membership, and the purchase / upgrade / Razorpay verification flow
export function useMartPlus(storeId: string | undefined) {
  const { fetchData, ...data } = useMembershipData(storeId);
  const checkout = useMembershipCheckout(storeId, fetchData);
  return { ...data, ...checkout };
}
