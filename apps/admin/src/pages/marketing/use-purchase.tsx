import { useState } from "react";
import { App } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { payWithRazorpay } from "../../components/RazorpayPay";
import { BillingModal, hasBilling } from "./billing-form";
import type { AdProduct, BillingInterval, BillingProfile, BillingValues } from "./types";
import { errorMessage } from "./utils";

interface Pending { product: AdProduct; quantity: number; interval: BillingInterval }

/** Buys a marketing product through Razorpay, asking for billing details first when the organisation has none */
export function usePurchase(profile: BillingProfile | null, onProfileSaved: (p: BillingProfile) => void, onPaid: () => Promise<void>) {
  const { notification } = App.useApp();
  const [buying, setBuying] = useState<string | null>(null);
  const [needsBilling, setNeedsBilling] = useState<Pending | null>(null);

  const payOrder = async ({ product, quantity }: Pending) => {
    const order = (await axiosInstance.post("/marketing/orders", { productId: product.id, quantity })).data.data;
    const payment = await payWithRazorpay(order.checkout, product.name);
    await axiosInstance.post(`/marketing/orders/${order.orderId}/verify`, payment);
    return `${product.name} is active.`;
  };

  const paySubscription = async ({ product, interval }: Pending) => {
    const sub = (await axiosInstance.post("/marketing/subscription", { productId: product.id, interval })).data.data;
    const payment = await payWithRazorpay({ subscriptionId: sub.subscriptionId, keyId: sub.keyId }, product.name);
    await axiosInstance.post("/marketing/subscription/verify", payment);
    if (!sub.startsAt) return `${product.name} is active and renews automatically.`;
    return `Your ${product.name} plan starts on ${dayjs(sub.startsAt).format("D MMM YYYY")}; you won't be charged until then.`;
  };

  const pay = async (pending: Pending) => {
    setBuying(pending.product.id);
    try {
      const description = await (pending.product.kind === "STORE_PLAN" ? paySubscription(pending) : payOrder(pending));
      await onPaid();
      notification.success({ message: "Payment received", description });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not complete the purchase") });
    } finally {
      setBuying(null);
    }
  };

  const buy = (product: AdProduct, quantity = 1, interval: BillingInterval = "MONTHLY") => {
    if (hasBilling(profile)) void pay({ product, quantity, interval });
    else setNeedsBilling({ product, quantity, interval });
  };

  const saveBilling = async (values: BillingValues) => {
    try {
      await axiosInstance.put("/marketing/billing-profile", values);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save billing details") });
      return;
    }
    const pending = needsBilling;
    onProfileSaved({ ...values, gstin: values.gstin ?? null });
    setNeedsBilling(null);
    if (pending) await pay(pending);
  };

  const modal = (
    <BillingModal
      open={!!needsBilling}
      title="Add your billing details"
      okText="Save and pay"
      profile={profile}
      onSubmit={saveBilling}
      onClose={() => setNeedsBilling(null)}
    />
  );
  return { buying, buy, modal };
}
