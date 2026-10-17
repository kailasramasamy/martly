import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import type { AdOrderCheckout, BillingProfile } from "./plan-types";

export interface PaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export const billingComplete = (p: BillingProfile) => !!(p.billingName && p.billingAddress && p.billingState);

/** Buy a marketing product: billing details first, then an order, Razorpay, and server-side verification */
export function useAdCheckout(onPaid: () => void) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [order, setOrder] = useState<AdOrderCheckout | null>(null);

  const buy = async (productId: string, quantity: number) => {
    const profile = await run(() => api.get<BillingProfile>("/api/v1/marketing/billing-profile"));
    if (!profile) return;
    if (!billingComplete(profile.data)) {
      toast.show("Add your billing details before paying", "info");
      router.push("/manage/marketing-plan/billing");
      return;
    }
    const created = await run(() => api.post<AdOrderCheckout>("/api/v1/marketing/orders", { productId, quantity }));
    if (created) setOrder(created.data);
  };

  const onSuccess = async (payment: PaymentResult) => {
    const orderId = order?.orderId;
    setOrder(null);
    if (!orderId) return;
    const verified = await run(() => api.post(`/api/v1/marketing/orders/${orderId}/verify`, payment), "Payment received");
    if (verified) onPaid();
  };

  return { buy, order, running, onSuccess, onCancel: () => setOrder(null) };
}
