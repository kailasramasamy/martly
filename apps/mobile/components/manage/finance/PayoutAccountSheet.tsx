import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { payoutAccountSchema } from "@martly/shared/schemas";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { colors, fonts, radius } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import type { PayoutAccount } from "../../../lib/ledger-types";

const EMPTY = { accountHolder: "", accountNumber: "", ifsc: "", upiVpa: "" };

/** The saved details, ready to edit; the account number stays blank because only its last 4 digits are ever shown */
const fromAccount = (a: PayoutAccount | null) =>
  ({ ...EMPTY, accountHolder: a?.accountHolder ?? "", ifsc: a?.ifsc ?? "", upiVpa: a?.upiVpa ?? "" });

/** Blank fields are left out, so only what the owner typed is sent and validated */
function toInput(form: typeof EMPTY) {
  const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
  return Object.fromEntries(Object.entries(trimmed).filter(([, v]) => v !== ""));
}

interface Props { account: PayoutAccount | null; visible: boolean; onClose: () => void; onSaved: () => void }

/** Mounted fresh on each open, so the form starts from the saved details */
export function PayoutAccountSheet({ account, visible, onClose, onSaved }: Props) {
  const { run, running } = useAction();
  const [form, setForm] = useState(() => fromAccount(account));
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const parsed = payoutAccountSchema.safeParse(toInput(form));
    if (!parsed.success) return setProblem(parsed.error.issues[0].message);
    setProblem(null);
    const saved = await run(() => api.put("/api/v1/ledger/payout-account", parsed.data), "Saved. Payouts resume once Martly verifies it.");
    if (saved) onSaved();
  };

  return (
    <BottomSheet
      visible={visible}
      title={account ? "Change payout account" : "Add payout account"}
      onClose={onClose}
      scrollable
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.btn} disabled={running} />
          <Button label="Save" icon="checkmark" onPress={save} loading={running} style={styles.btn} />
        </View>
      }
    >
      <View style={styles.form}>
        <View style={styles.warning}>
          <Text style={styles.warningText}>Saving changes pauses payouts until Martly verifies the new details. Held money is paid out on the next run after that.</Text>
        </View>
        <TextField label="Account holder" required value={form.accountHolder} onChangeText={set("accountHolder")} autoCapitalize="words" />
        <TextField label="Account number" hint={account?.accountLast4 ? `Leave blank to keep ••••${account.accountLast4}` : undefined} value={form.accountNumber} onChangeText={set("accountNumber")} keyboardType="number-pad" maxLength={18} />
        <TextField label="IFSC" value={form.ifsc} onChangeText={set("ifsc")} autoCapitalize="characters" maxLength={11} />
        <TextField label="UPI ID" hint="Use a UPI ID instead of a bank account, if you prefer" value={form.upiVpa} onChangeText={set("upiVpa")} autoCapitalize="none" />
        {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: 10, paddingBottom: 8 },
  btn: { flex: 1 },
  form: { gap: 12, paddingBottom: 12 },
  warning: { backgroundColor: manage.attentionBg, borderRadius: radius.lg, padding: 12 },
  warningText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: manage.attentionText },
  problem: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error },
});
