import { useState } from "react";
import { BottomSheet } from "../../../search/BottomSheet";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

export interface PaidDetails { method: "BANK_TRANSFER" | "UPI"; utr: string }

const METHODS = [{ value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "UPI", label: "UPI" }];

interface PaidProps {
  visible: boolean;
  count: number;
  running: boolean;
  onSubmit: (details: PaidDetails) => void;
  onClose: () => void;
}

export function MarkPaidSheet({ visible, count, running, onSubmit, onClose }: PaidProps) {
  const [method, setMethod] = useState<PaidDetails["method"]>("BANK_TRANSFER");
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = () => {
    const ref = utr.trim();
    if (ref.length < 6 || ref.length > 40) return setError("Enter the UTR (6 to 40 characters)");
    setError(undefined);
    onSubmit({ method, utr: ref });
  };

  return (
    <BottomSheet visible={visible} title={`Mark ${count} payout${count === 1 ? "" : "s"} paid`} onClose={onClose} scrollable footer={<Button label="Mark paid" onPress={submit} loading={running} />}>
      <SelectField label="Method" required value={method} options={METHODS} onChange={(v) => setMethod(v as PaidDetails["method"])} />
      <TextField label="UTR / reference" required value={utr} onChangeText={setUtr} maxLength={40} autoCapitalize="characters" hint="Applied to every selected payout" error={error} />
    </BottomSheet>
  );
}

interface FailedProps {
  number: string | null;
  running: boolean;
  onSubmit: (reason: string) => void;
  onClose: () => void;
}

export function MarkFailedDialog({ number, running, onSubmit, onClose }: FailedProps) {
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      visible={!!number}
      title={`Mark ${number ?? ""} failed`}
      message="Say why the transfer failed. The owner can see this."
      confirmLabel="Mark failed"
      running={running}
      onConfirm={() => onSubmit(reason.trim())}
      onClose={onClose}
    >
      <TextField label="Reason" required value={reason} onChangeText={setReason} multiline maxLength={300} placeholder="Why did the transfer fail?" />
    </ConfirmDialog>
  );
}
