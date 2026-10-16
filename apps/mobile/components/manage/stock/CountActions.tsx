import { Button } from "../ui/Button";
import type { CountStatus } from "./types";

interface CountActionsProps {
  status: CountStatus;
  canApprove: boolean;
  /** Counter is working on a count they can still edit (first count or recount) */
  editing: boolean;
  running: boolean;
  /** Approver is choosing lines to send back; null when not choosing */
  selectedCount: number | null;
  onSave: () => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onApprove: () => void;
  onReject: () => void;
  onStartRecount: () => void;
  onCancelRecount: () => void;
  onSendRecount: () => void;
}

function ReviewButtons(p: CountActionsProps) {
  if (p.selectedCount !== null) {
    return (
      <>
        <Button label="Cancel" variant="secondary" onPress={p.onCancelRecount} disabled={p.running} />
        <Button label={`Send ${p.selectedCount} for recount`} onPress={p.onSendRecount} disabled={p.selectedCount === 0} style={{ flex: 1 }} />
      </>
    );
  }
  return (
    <>
      <Button label="Reject" variant="danger" onPress={p.onReject} disabled={p.running} />
      <Button label={"Recount…"} variant="secondary" onPress={p.onStartRecount} disabled={p.running} style={{ flex: 1 }} />
      <Button label="Approve" onPress={p.onApprove} loading={p.running} style={{ flex: 1 }} />
    </>
  );
}

/** Sticky action buttons per lifecycle state; null when the member has nothing to do */
export function CountActions(p: CountActionsProps) {
  if (p.editing && p.status === "DRAFT") {
    return (
      <>
        <Button label="Discard" variant="danger" onPress={p.onDiscard} disabled={p.running} />
        <Button label="Save" variant="secondary" onPress={p.onSave} disabled={p.running} />
        <Button label="Submit count" onPress={p.onSubmit} loading={p.running} style={{ flex: 1 }} />
      </>
    );
  }
  if (p.editing && p.status === "RECOUNT") {
    return (
      <>
        <Button label="Save" variant="secondary" onPress={p.onSave} disabled={p.running} />
        <Button label="Submit recount" onPress={p.onSubmit} loading={p.running} style={{ flex: 1 }} />
      </>
    );
  }
  if (p.status === "SUBMITTED" && p.canApprove) return <ReviewButtons {...p} />;
  return null;
}
