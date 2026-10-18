import { useEffect, useState } from "react";
import { Linking, type ImageSourcePropType } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UpiAppId = "gpay" | "phonepe" | "paytm";

export interface UpiApp {
  id: UpiAppId;
  label: string;
  /** Android package; Razorpay identifies UPI apps by it on both platforms */
  packageName: string;
  /** App-specific replacement for `upi://pay` so the payment opens in this app, not a chooser */
  launchPrefix: string;
  logo: ImageSourcePropType;
}

export const UPI_APPS: UpiApp[] = [
  { id: "gpay", label: "Google Pay", packageName: "com.google.android.apps.nbu.paisa.user", launchPrefix: "tez://upi/pay", logo: require("../assets/upi/gpay.png") },
  { id: "phonepe", label: "PhonePe", packageName: "com.phonepe.app", launchPrefix: "phonepe://pay", logo: require("../assets/upi/phonepe.png") },
  { id: "paytm", label: "Paytm", packageName: "net.one97.paytm", launchPrefix: "paytmmp://pay", logo: require("../assets/upi/paytm.png") },
];

/** Rewrites Razorpay's generic `upi://pay?…` intent link to open in the chosen app */
export function appPaymentLink(app: UpiApp, upiLink: string): string {
  return upiLink.replace(/^upi:\/\/pay/, app.launchPrefix);
}

/** UPI apps installed on this phone, in UPI_APPS order; null while checking */
export function useInstalledUpiApps(): UpiApp[] | null {
  const [installed, setInstalled] = useState<UpiApp[] | null>(null);

  useEffect(() => {
    Promise.all(UPI_APPS.map((app) => Linking.canOpenURL(`${app.launchPrefix}?`).catch(() => false)))
      .then((found) => setInstalled(UPI_APPS.filter((_, i) => found[i])));
  }, []);

  return installed;
}

export type PaymentChoice = { kind: "upi"; app: UpiAppId } | { kind: "razorpay" } | { kind: "cod" };

// Kept on the device, not the account: which UPI apps exist differs from phone to phone
const CHOICE_KEY = "martly_payment_choice";

export async function loadPaymentChoice(): Promise<PaymentChoice | null> {
  const raw = await AsyncStorage.getItem(CHOICE_KEY);
  return raw ? (JSON.parse(raw) as PaymentChoice) : null;
}

export function savePaymentChoice(choice: PaymentChoice): Promise<void> {
  return AsyncStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
}
