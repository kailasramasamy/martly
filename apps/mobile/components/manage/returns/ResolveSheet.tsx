import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { formatINR } from "../ui/tokens";

export type Resolution = "APPROVED" | "REJECTED";

interface ResolveSheetProps {
  requestId: string;
  requestedAmount: number;
  mode: Resolution | null;
  onClose: () => void;
  onResolved: () => void;
}

export function ResolveSheet({ requestId, requestedAmount, mode, onClose, onResolved }: ResolveSheetProps) {
  const { run, running } = useAction();
  const [amount, setAmount] = useState(String(requestedAmount));
  const [note, setNote] = useState("");
  const approving = mode === "APPROVED";
  const value = Number(amount);
  const amountError = approving && (!(value >= 0) || value > requestedAmount) ? `Enter 0 to ${formatINR(requestedAmount)}` : undefined;
  const blocked = approving ? !!amountError || amount === "" : !note.trim();

  const submit = async () => {
    const body = approving
      ? { status: mode, approvedAmount: value, ...(note.trim() ? { adminNote: note.trim() } : {}) }
      : { status: mode, adminNote: note.trim() };
    const done = await run(() => api.patch(`/api/v1/return-requests/${requestId}/resolve`, body), approving ? "Return approved and refunded" : "Return rejected");
    if (!done) return;
    setNote("");
    onResolved();
    onClose();
  };

  return (
    <BottomSheet
      visible={!!mode}
      title={approving ? "Approve return" : "Reject return"}
      onClose={onClose}
      footer={<Button label={approving ? "Approve and refund" : "Reject request"} variant={approving ? "primary" : "danger"} onPress={submit} loading={running} disabled={blocked} />}
    >
      <View style={styles.body}>
        {approving && (
          <TextField
            label="Refund amount"
            prefix={"₹"}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            error={amountError}
            hint={`Requested ${formatINR(requestedAmount)}. Lower it for a partial refund; it is credited to the customer's wallet.`}
          />
        )}
        <TextField
          label={approving ? "Note (optional)" : "Reason for rejection"}
          required={!approving}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder={approving ? "Reason for approval or partial refund" : "Explain why this return is rejected"}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: 14, paddingBottom: 8 } });
