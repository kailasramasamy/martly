import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import { api, ApiError } from "./api";
import { appPaymentLink, type UpiApp } from "./upi-apps";

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 30;

/**
 * Server-to-server UPI intent: our API creates the payment, the chosen UPI app opens straight away,
 * and when the customer comes back we poll until the server sees it captured (the webhook settles it too).
 */
export function useUpiIntentPayment(onDone: (orderId: string, paid: boolean) => void) {
  const [confirming, setConfirming] = useState(false);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateSub = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);

  const stop = useCallback(() => {
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    appStateSub.current?.remove();
    appStateSub.current = null;
    setConfirming(false);
  }, []);

  useEffect(() => stop, [stop]);

  const poll = useCallback((orderId: string, attempt: number) => {
    api.get<{ paymentStatus: string }>(`/api/v1/orders/${orderId}/payment/status`)
      .then((res) => res.data.paymentStatus === "PAID")
      .catch(() => false)
      .then((paid) => {
        if (!active.current) return; // cancelled while the request was in flight
        if (paid || attempt + 1 >= POLL_ATTEMPTS) {
          stop();
          onDone(orderId, paid);
          return;
        }
        timer.current = setTimeout(() => poll(orderId, attempt + 1), POLL_INTERVAL_MS);
      });
  }, [onDone, stop]);

  /** Opens the UPI app for the order; false when S2S isn't available so the caller can use Razorpay's sheet */
  const start = useCallback(async (orderId: string, app: UpiApp): Promise<boolean> => {
    let link: string;
    try {
      link = (await api.post<{ link: string }>(`/api/v1/orders/${orderId}/payment/upi-intent`, {})).data.link;
    } catch (err) {
      if (err instanceof ApiError) return false;
      throw err;
    }
    const url = appPaymentLink(app, link);
    if (!(await Linking.canOpenURL(url))) return false;

    active.current = true;
    appStateSub.current = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      appStateSub.current?.remove();
      appStateSub.current = null;
      setConfirming(true);
      poll(orderId, 0);
    });
    await Linking.openURL(url);
    return true;
  }, [poll]);

  return { start, confirming, cancel: stop };
}
