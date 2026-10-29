import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { onlineCharge, paymentDeadline } from "@martly/shared/order-flow";
import { colors, fonts } from "../../constants/theme";
import { ApiError } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { UPI_APPS, loadPaymentChoice, useInstalledUpiApps, type UpiApp } from "../../lib/upi-apps";
import { useOrderPayment } from "../checkout/use-order-payment";
import { rupees } from "../orders/format";
import type { OrderData } from "./types";

/** Whole minutes until the unpaid order is cancelled, ticking down while the screen is open */
export function useMinutesLeft(createdAt: string): number {
  const deadline = paymentDeadline({ createdAt }).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 60_000));
}

/** The UPI app the customer last paid with, if it's still on this phone */
function useChosenUpiApp(): UpiApp | undefined {
  const installed = useInstalledUpiApps();
  const [app, setApp] = useState<UpiApp | undefined>();
  useEffect(() => {
    if (!installed) return;
    loadPaymentChoice().then((choice) => {
      const saved = choice?.kind === "upi" ? UPI_APPS.find((a) => a.id === choice.app) : undefined;
      setApp(saved && installed.includes(saved) ? saved : installed[0]);
    });
  }, [installed]);
  return app;
}

/** Shown on an online order that isn't paid yet: how long is left and a button to pay again */
export function CompletePayment({ order, onPaid }: { order: OrderData; onPaid: () => void }) {
  const t = useStrings("orders").pay;
  const toast = useToast();
  const app = useChosenUpiApp();
  const minutesLeft = useMinutesLeft(order.createdAt);
  const [opening, setOpening] = useState(false);
  const amount = rupees(onlineCharge(order));
  const payment = useOrderPayment((_id, paid) => {
    toast.show(paid ? t.paid : t.notPaid, paid ? "success" : "info");
    onPaid();
  });

  const pay = async () => {
    setOpening(true);
    try {
      await payment.pay(order.id, app);
    } catch (err) {
      // An API refusal (e.g. the order just expired) says why; fetch's TypeError means no connection
      if (!(err instanceof ApiError) && !(err instanceof TypeError)) throw err;
      toast.show(err instanceof ApiError ? err.message : t.openFailed, "error");
      onPaid();
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="time-outline" size={20} color="#b45309" />
        <Text style={styles.title}>{t.title}</Text>
      </View>
      <Text style={styles.body}>{minutesLeft > 0 ? t.body(amount, minutesLeft) : t.expired}</Text>
      {minutesLeft > 0 && (
        <TouchableOpacity style={[styles.button, opening && styles.buttonBusy]} onPress={pay} disabled={opening} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{t.payWith(amount, app?.label)}</Text>
        </TouchableOpacity>
      )}
      {payment.sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fcd34d", gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontFamily: fonts.extrabold, color: "#92400e" },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fonts.medium, color: colors.text },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonBusy: { opacity: 0.6 },
  buttonText: { fontSize: 15, fontFamily: fonts.bold, color: "#fff" },
});
