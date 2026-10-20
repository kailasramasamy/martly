import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { formatINR, manage, tabular } from "../../ui/tokens";
import { PaymentChoice, type CollectedVia } from "../PaymentChoice";

interface PaymentStepProps {
  cod: boolean;
  /** Cash due before anything was refused */
  fullDue: number;
  /** Value of refused units, net of their coupon share */
  refusedValue: number;
  /** Cash handed back for returns collected at this door */
  handBack: number;
  via: CollectedVia;
  onVia: (via: CollectedVia) => void;
}

function Line({ label, value, strong, minus }: { label: string; value: number; strong?: boolean; minus?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && styles.strongLabel]}>{label}</Text>
      <Text style={[styles.lineValue, tabular, strong && styles.strongValue, minus && styles.minus]}>{minus ? "−" : ""}{formatINR(value)}</Text>
    </View>
  );
}

function HandBack({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <View style={styles.handBack}>
      <Text style={styles.handBackLabel}>Hand back cash</Text>
      <Text style={[styles.handBackValue, tabular]}>{formatINR(amount)}</Text>
    </View>
  );
}

/** Step 3: what to collect after anything the customer didn't take, and how they paid */
export function PaymentBody({ cod, fullDue, refusedValue, handBack, via, onVia }: PaymentStepProps) {
  if (!cod) {
    return (
      <View style={styles.box}>
        <HandBack amount={handBack} />
        <Text style={styles.paid}>Already paid online. Nothing to collect.</Text>
        {refusedValue > 0 && <Text style={styles.note}>{formatINR(refusedValue)} for the items not taken goes back to the customer's Martly wallet.</Text>}
      </View>
    );
  }
  const due = Math.max(0, fullDue - refusedValue);
  return (
    <>
      <View style={styles.box}>
        {refusedValue > 0 && <Line label="Order" value={fullDue} />}
        {refusedValue > 0 && <Line label="Items not taken" value={refusedValue} minus />}
        <Line label="Collect" value={due} strong />
      </View>
      <HandBack amount={handBack} />
      <PaymentChoice value={via} onChange={onVia} />
    </>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, padding: 14, borderRadius: 14, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.line },
  line: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  lineLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  lineValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  strongLabel: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  strongValue: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text },
  minus: { color: colors.error },
  handBack: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", padding: 14, borderRadius: 14, backgroundColor: colors.primary },
  handBackLabel: { fontFamily: fonts.bold, fontSize: 17, color: "#fff" },
  handBackValue: { fontFamily: fonts.extrabold, fontSize: 28, color: "#fff" },
  paid: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.primary },
  note: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
});
