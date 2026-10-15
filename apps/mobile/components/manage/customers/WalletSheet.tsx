import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TextField } from "../ui/TextField";
import { formatINR } from "../ui/tokens";

type AdjustType = "CREDIT" | "DEBIT";

interface WalletSheetProps {
  visible: boolean;
  customerId: string;
  balance: number;
  onClose: () => void;
  onDone: () => void;
}

const TYPES = [
  { value: "CREDIT" as const, label: "Credit" },
  { value: "DEBIT" as const, label: "Debit" },
];

export function WalletSheet({ visible, customerId, balance, onClose, onDone }: WalletSheetProps) {
  const { run, running } = useAction();
  const [type, setType] = useState<AdjustType>("CREDIT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const value = Number(amount);
  const error = amount && (!(value >= 1) || value > 100000) ? "Enter an amount between 1 and 100000" : undefined;

  const submit = async () => {
    const done = await run(
      () => api.post(`/api/v1/wallet/admin/${customerId}/adjust`, { type, amount: value, description: note.trim() || undefined }),
      type === "CREDIT" ? "Wallet credited" : "Wallet debited",
    );
    if (!done) return;
    setAmount("");
    setNote("");
    onDone();
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title="Adjust wallet"
      onClose={onClose}
      footer={<Button label={type === "CREDIT" ? "Credit wallet" : "Debit wallet"} onPress={submit} loading={running} disabled={!amount || !!error} />}
    >
      <View style={styles.body}>
        <SegmentedTabs options={TYPES} value={type} onChange={setType} />
        <TextField
          label="Amount"
          prefix={"₹"}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          error={error}
          hint={`Current balance ${formatINR(balance)}`}
        />
        <TextField label="Note" value={note} onChangeText={setNote} placeholder="Shown in the customer's wallet history" maxLength={200} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: 14, paddingBottom: 8 } });
