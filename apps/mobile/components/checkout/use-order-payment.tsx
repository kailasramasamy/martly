import { useCallback, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useUpiIntentPayment } from "../../lib/use-upi-payment";
import type { UpiApp } from "../../lib/upi-apps";
import { RazorpayCheckout } from "../RazorpayCheckout";
import { PaymentConfirming, UpiHandoff } from "./PaymentOptions";

interface RazorpayData {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  customer_id?: string;
  upi_s2s: boolean;
}

/**
 * Takes an order's online payment: straight into the chosen UPI app when S2S is on, otherwise Razorpay's sheet.
 * `onSettled` gets whether the payment went through; render `sheets` on the screen.
 */
export function useOrderPayment(onSettled: (orderId: string, paid: boolean) => void) {
  const { user } = useAuth();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [razorpay, setRazorpay] = useState<RazorpayData | null>(null);
  const [app, setApp] = useState<UpiApp | undefined>();
  const upiIntent = useUpiIntentPayment(onSettled);

  /** Throws when the payment can't be opened (gateway down, order cancelled) */
  const pay = useCallback(async (id: string, upiApp?: UpiApp) => {
    const res = await api.post<RazorpayData>(`/api/v1/orders/${id}/payment`, {});
    setOrderId(id);
    setApp(upiApp);
    if (upiApp && res.data.upi_s2s && (await upiIntent.start(id, upiApp))) return;
    setRazorpay(res.data);
  }, [upiIntent]);

  const stopUpi = () => {
    upiIntent.cancel();
    onSettled(orderId!, false);
  };

  const sheets = (
    <>
      {razorpay && (
        <RazorpayCheckout
          visible
          keyId={razorpay.key_id}
          orderId={razorpay.razorpay_order_id}
          amount={razorpay.amount}
          currency={razorpay.currency}
          customerId={razorpay.customer_id}
          upiAppPackage={app?.packageName}
          prefill={{ email: user?.email, name: user?.name, contact: user?.phone ?? undefined }}
          onSuccess={async (data) => {
            setRazorpay(null);
            // Razorpay reported success; if our check fails the webhook still settles the order
            await api.post(`/api/v1/orders/${orderId}/payment/verify`, data).catch(() => {});
            onSettled(orderId!, true);
          }}
          onCancel={() => {
            setRazorpay(null);
            onSettled(orderId!, false);
          }}
        />
      )}
      <UpiHandoff visible={upiIntent.handoff} app={app} onContinue={upiIntent.openApp} onCancel={stopUpi} />
      <PaymentConfirming visible={upiIntent.confirming} appLabel={app?.label} onCancel={stopUpi} />
    </>
  );

  return { pay, sheets };
}
