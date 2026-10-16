import { useEffect, useState } from "react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TextField } from "../ui/TextField";

export type CountDialog = "submit" | "discard" | "approve" | "reject" | null;

interface CountReviewDialogsProps {
  dialog: CountDialog;
  running: boolean;
  counted: number;
  total: number;
  /** Submitting a recount, not a first count */
  recount: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onReview: (action: "approve" | "reject", note: string) => void;
}

/** Confirmations for every destructive or stock-changing step on a count */
export function CountReviewDialogs({ dialog, running, counted, total, recount, onClose, onSubmit, onDiscard, onReview }: CountReviewDialogsProps) {
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [dialog]);
  const common = { running, onClose };
  return (
    <>
      <ConfirmDialog {...common} visible={dialog === "submit"} confirmVariant="primary" title={recount ? "Submit recount?" : "Submit count?"} confirmLabel="Submit"
        message={`${counted} of ${total} items ${recount ? "recounted" : "counted"}. You can't edit the count after submitting.`} onConfirm={onSubmit} />
      <ConfirmDialog {...common} visible={dialog === "discard"} title="Discard count?" confirmLabel="Discard"
        message="Everything entered for this count will be deleted." onConfirm={onDiscard} />
      <ConfirmDialog {...common} visible={dialog === "approve"} confirmVariant="primary" title="Approve count?" confirmLabel="Approve"
        message="Store stock will be updated to the counted quantities." onConfirm={() => onReview("approve", note)}>
        <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline maxLength={500} />
      </ConfirmDialog>
      <ConfirmDialog {...common} visible={dialog === "reject"} title="Reject count?" confirmLabel="Reject"
        message="Stock stays unchanged. The counter will see your note." onConfirm={() => onReview("reject", note)}>
        <TextField label="Reason" required value={note} onChangeText={setNote} multiline maxLength={500} placeholder="What needs recounting?" />
      </ConfirmDialog>
    </>
  );
}
