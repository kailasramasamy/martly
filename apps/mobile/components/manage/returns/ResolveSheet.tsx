import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { api } from "../../../lib/api";
import { colors, fonts } from "../../../constants/theme";
import { useAction } from "../../../lib/manage/use-action";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { formatINR } from "../ui/tokens";
import { OutcomeChoices, RefundField, RestockToggles, nextStepText } from "./ApproveFields";
import type { ReturnRequestDetail } from "./types";
import { useResolveForm } from "./use-resolve-form";

export type Resolution = "APPROVED" | "REJECTED";

interface ResolveSheetProps {
  request: ReturnRequestDetail;
  mode: Resolution | null;
  onClose: () => void;
  onResolved: () => void;
}

export function ResolveSheet({ request, mode, onClose, onResolved }: ResolveSheetProps) {
  const requestedAmount = Number(request.requestedAmount);
  const { hint, amount, setAmount, remedy, setRemedy, method, setMethod, restock, setRestock } = useResolveForm(request);
  const { run, running } = useAction();
  const [note, setNote] = useState("");

  const approving = mode === "APPROVED";
  const refunding = remedy === "REFUND";
  const value = Number(amount);
  const amountError = approving && refunding && (!(value >= 0) || value > requestedAmount) ? `Enter 0 to ${formatINR(requestedAmount)}` : undefined;
  const blocked = approving ? !!amountError || (refunding && amount === "") : !note.trim();
  const noteText = note.trim() ? { adminNote: note.trim() } : {};

  const submit = async () => {
    const restockItemIds = method === "KEEP" ? [] : request.items.filter((i) => restock[i.id]).map((i) => i.id);
    const body = approving
      ? { status: mode, remedy, method, ...(refunding ? { approvedAmount: value } : {}), restockItemIds, ...noteText }
      : { status: mode, adminNote: note.trim() };
    const done = await run(() => api.patch(`/api/v1/return-requests/${request.id}/resolve`, body), approving ? "Return approved" : "Return rejected");
    if (!done) return;
    setNote("");
    onResolved();
    onClose();
  };

  const approveLabel = refunding && method === "KEEP" ? "Approve and refund" : "Approve";
  return (
    <BottomSheet
      scrollable
      visible={!!mode}
      title={approving ? "Approve return" : "Reject return"}
      onClose={onClose}
      footer={<Button label={approving ? approveLabel : "Reject request"} variant={approving ? "primary" : "danger"} onPress={submit} loading={running} disabled={blocked} />}
    >
      <View style={styles.body}>
        {approving && <OutcomeChoices remedy={remedy} method={method} keepHint={method === "KEEP" ? hint : null} onRemedy={setRemedy} onMethod={setMethod} />}
        {approving && refunding && <RefundField amount={amount} requested={requestedAmount} error={amountError} onChange={setAmount} />}
        {approving && method !== "KEEP" && <RestockToggles items={request.items} restock={restock} onToggle={(id, on) => setRestock((r) => ({ ...r, [id]: on }))} />}
        <TextField
          label={approving ? "Note (optional)" : "Reason for rejection"}
          required={!approving}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder={approving ? "Reason for approval or partial refund" : "Explain why this return is rejected"}
        />
        {approving && <Text style={styles.next}>{nextStepText(remedy, method)}</Text>}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 8 },
  next: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
});
