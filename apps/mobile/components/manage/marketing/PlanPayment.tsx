import { RazorpayCheckout } from "../../RazorpayCheckout";
import { useAuth } from "../../../lib/auth-context";
import type { useAdCheckout } from "./use-ad-checkout";

/** The Razorpay sheet for whichever marketing purchase (one-off order or subscription) is in flight */
export function PlanPayment({ checkout, description = "Marketing plan" }: { checkout: ReturnType<typeof useAdCheckout>; description?: string }) {
  const { user } = useAuth();
  const prefill = { email: user?.email, name: user?.name, contact: user?.phone ?? undefined };
  const { order, subscription } = checkout;
  if (order) {
    return (
      <RazorpayCheckout visible keyId={order.checkout.keyId} orderId={order.checkout.orderId} amount={order.checkout.amount} currency={order.checkout.currency}
        name="Martly Marketing" description={description} prefill={prefill} onSuccess={checkout.onSuccess} onCancel={checkout.onCancel} />
    );
  }
  if (!subscription) return null;
  return (
    <RazorpayCheckout visible keyId={subscription.keyId} subscriptionId={subscription.subscriptionId}
      name="Martly Marketing" description={`${subscription.planName} plan`} prefill={prefill} onSuccess={checkout.onSubscribed} onCancel={checkout.onCancel} />
  );
}
