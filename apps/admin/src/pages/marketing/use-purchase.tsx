import { useState } from "react";
import { App } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { payWithRazorpay } from "../../components/RazorpayPay";
import { BillingModal, hasBilling } from "./billing-form";
import type { AdProduct, BillingProfile, BillingValues } from "./types";
import { errorMessage } from "./utils";

interface Pending { product: AdProduct; quantity: number }

/** Buys a marketing product through Razorpay, asking for billing details first when the organisation has none */
export function usePurchase(profile: BillingProfile | null, onProfileSaved: (p: BillingProfile) => void, onPaid: () => Promise<void>) {
  const { notification } = App.useApp();
  const [buying, setBuying] = useState<string | null>(null);
  const [needsBilling, setNeedsBilling] = useState<Pending | null>(null);

  const pay = async ({ product, quantity }: Pending) => {
    setBuying(product.id);
    try {
      const res = await axiosInstance.post("/marketing/orders", { productId: product.id, quantity });
      const order = res.data.data;
      const payment = await payWithRazorpay(order.checkout, product.name);
      await axiosInstance.post(`/marketing/orders/${order.orderId}/verify`, payment);
      await onPaid();
      notification.success({ message: "Payment received", description: `${product.name} is active.` });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not complete the purchase") });
    } finally {
      setBuying(null);
    }
  };

  const buy = (product: AdProduct, quantity = 1) => {
    if (hasBilling(profile)) void pay({ product, quantity });
    else setNeedsBilling({ product, quantity });
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
