import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import { startActivityAsync } from "expo-intent-launcher";
import { api, ApiError } from "./api";
import { appPaymentLink, type UpiApp } from "./upi-apps";

const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 30;

// The order a checkout is waiting on the UPI app for; its "payment received" push tap is left to that checkout
let awaitingOrderId: string | null = null;

export function isAwaitingUpiReturn(orderId: string): boolean {
  return awaitingOrderId === orderId;
}

/**
 * Server-to-server UPI intent: our API creates the payment, the chosen UPI app opens straight away,
 * and when the customer comes back we poll until the server sees it captured (the webhook settles it too).
 * Android opens the UPI app for a result, so it hands the customer back to us once they've paid.
 * iOS can't, so we first tell the customer to come back (`handoff`) and the payment push links back here.
 */
export function useUpiIntentPayment(onDone: (orderId: string, paid: boolean) => void) {
  const [confirming, setConfirming] = useState(false);
  const [handoff, setHandoff] = useState<{ orderId: string; url: string } | null>(null);
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateSub = useRef<ReturnType<typeof AppState.addEventListener> | null>(null);

  const stop = useCallback(() => {
    active.current = false;
    awaitingOrderId = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    appStateSub.current?.remove();
    appStateSub.current = null;
    setConfirming(false);
    setHandoff(null);
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

  const confirm = useCallback((orderId: string) => {
    if (!active.current) return;
    setConfirming(true);
    poll(orderId, 0);
  }, [poll]);

  /** iOS: opens the UPI app once the customer has read how to come back; we confirm when the app is active again */
  const openApp = useCallback(async () => {
    if (!handoff) return;
    const { orderId, url } = handoff;
    setHandoff(null);
    appStateSub.current = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      appStateSub.current?.remove();
      appStateSub.current = null;
      confirm(orderId);
    });
    await Linking.openURL(url);
  }, [handoff, confirm]);

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
    awaitingOrderId = orderId;
    if (Platform.OS === "ios") {
      setHandoff({ orderId, url });
      return true;
    }
    // Resolves when the UPI app finishes and returns the customer here
    await startActivityAsync("android.intent.action.VIEW", { data: link, packageName: app.packageName });
    confirm(orderId);
    return true;
  }, [confirm]);

  return { start, confirming, handoff: handoff !== null, openApp, cancel: stop };
}
