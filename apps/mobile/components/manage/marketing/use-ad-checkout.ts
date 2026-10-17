import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { formatDate } from "../ui/dates";
import type { SubscriptionPayment } from "../../RazorpayCheckout";
import type { AdOrderCheckout, AdProduct, BillingProfile, SubscriptionCheckout } from "./plan-types";

export interface PaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export const billingComplete = (p: BillingProfile) => !!(p.billingName && p.billingAddress && p.billingState);

/** Buy a marketing product: billing details first, then Razorpay (order or auto-renewing subscription) and server-side verification */
export function useAdCheckout(onPaid: () => void) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [order, setOrder] = useState<AdOrderCheckout | null>(null);
  const [subscription, setSubscription] = useState<(SubscriptionCheckout & { planName: string }) | null>(null);

  const billingReady = async () => {
    const profile = await run(() => api.get<BillingProfile>("/api/v1/marketing/billing-profile"));
    if (!profile) return false;
    if (billingComplete(profile.data)) return true;
    toast.show("Add your billing details before paying", "info");
    router.push("/manage/marketing-plan/billing");
    return false;
  };

  const buy = async (productId: string, quantity: number) => {
    if (!(await billingReady())) return;
    const created = await run(() => api.post<AdOrderCheckout>("/api/v1/marketing/orders", { productId, quantity }));
    if (created) setOrder(created.data);
  };

  const subscribe = async (plan: AdProduct) => {
    if (!(await billingReady())) return;
    const created = await run(() => api.post<SubscriptionCheckout>("/api/v1/marketing/subscription", { productId: plan.id }));
    if (created) setSubscription({ ...created.data, planName: plan.name });
  };

  const onSuccess = async (payment: PaymentResult) => {
    const orderId = order?.orderId;
    setOrder(null);
    if (!orderId) return;
    const verified = await run(() => api.post(`/api/v1/marketing/orders/${orderId}/verify`, payment), "Payment received");
    if (verified) onPaid();
  };

  const onSubscribed = async (payment: SubscriptionPayment) => {
    const pending = subscription;
    setSubscription(null);
    if (!pending) return;
    const verified = await run(() => api.post("/api/v1/marketing/subscription/verify", payment));
    if (!verified) return;
    toast.show(pending.startsAt ? `Your ${pending.planName} plan starts on ${formatDate(pending.startsAt)}; no charge until then` : "Payment received", "success");
    onPaid();
  };

  return { buy, subscribe, order, subscription, running, onSuccess, onSubscribed, onCancel: () => { setOrder(null); setSubscription(null); } };
}
