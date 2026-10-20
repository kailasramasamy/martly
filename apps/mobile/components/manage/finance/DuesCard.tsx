import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { colors, fonts, radius } from "../../../constants/theme";
import { RazorpayCheckout, type OrderPayment } from "../../RazorpayCheckout";
import { Button } from "../ui/Button";
import { formatINR, tabular } from "../ui/tokens";
import type { DuesCheckout } from "../../../lib/ledger-types";

/** What the organization owes Martly after a long negative balance; the owner pays it online and the balance is cleared */
export function DuesCard({ amount, canPay, onPaid }: { amount: number; canPay: boolean; onPaid: () => void }) {
  const { user } = useAuth();
  const { run, running } = useAction();
  const [checkout, setCheckout] = useState<DuesCheckout | null>(null);

  const start = async () => {
    const created = await run(() => api.post<DuesCheckout>("/api/v1/ledger/dues/pay", {}));
    if (created) setCheckout(created.data);
  };

  const verify = async (payment: OrderPayment) => {
    setCheckout(null);
    const done = await run(() => api.post("/api/v1/ledger/dues/verify", payment), "Payment received");
    if (done) onPaid();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{formatINR(amount)} due to Martly</Text>
      <Text style={styles.body}>Your balance has stayed negative for weeks. Pay now to clear it, or it keeps being recovered from your next payouts.</Text>
      {canPay ? <Button label="Pay now" icon="card-outline" onPress={start} loading={running} style={styles.button} /> : <Text style={styles.body}>Only the owner can pay this.</Text>}
      {checkout && (
        <RazorpayCheckout
          visible keyId={checkout.keyId} orderId={checkout.orderId} amount={checkout.amount} currency={checkout.currency}
          name="Martly" description="Amount due to Martly"
          prefill={{ email: user?.email, name: user?.name, contact: user?.phone ?? undefined }}
          onSuccess={verify} onCancel={() => setCheckout(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fef2f2", borderRadius: radius.xl, borderWidth: 1, borderColor: "#fecaca", padding: 16, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: "#b91c1c", ...tabular },
  body: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  button: { alignSelf: "flex-start", marginTop: 4 },
});
