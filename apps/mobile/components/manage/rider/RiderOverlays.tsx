import { useEffect, useState } from "react";
import { handoverNote } from "@martly/shared/order-flow";
import { formatINR } from "../ui/tokens";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FailDeliverySheet } from "./FailDeliverySheet";
import { PaymentChoice, type CollectedVia } from "./PaymentChoice";
import { StopSheet } from "./StopSheet";
import type { useRiderActions } from "./use-rider-actions";
import type { RiderOverlay } from "./types";

interface RiderOverlaysProps {
  overlay: RiderOverlay | null;
  actions: ReturnType<typeof useRiderActions>;
  onClose: () => void;
}

/** The stop details, delivered confirmation and couldn't-deliver sheets; `overlay` keeps only one open */
export function RiderOverlays({ overlay, actions, onClose }: RiderOverlaysProps) {
  const stop = overlay?.stop;
  const due = stop?.amountDue ?? 0;
  const cod = due > 0;
  const [via, setVia] = useState<CollectedVia>("CASH");
  // Each delivery starts on cash, the usual case; the rider switches to UPI when the customer paid that way
  useEffect(() => setVia("CASH"), [stop?.id]);
  const finish = async (done: Promise<boolean>) => {
    if (await done) onClose();
  };
  return (
    <>
      <StopSheet stop={overlay?.kind === "stop" ? overlay.stop : null} onClose={onClose} />
      <ConfirmDialog
        visible={overlay?.kind === "deliver"}
        title={stop ? `Delivered to ${stop.user.name}?` : ""}
        message={stop ? (cod ? `How did they pay ${formatINR(due)}?` : handoverNote(stop)) : ""}
        confirmLabel="Confirm"
        cancelLabel="Not yet"
        confirmVariant="primary"
        running={actions.running}
        onConfirm={() => stop && finish(actions.deliver(stop.id, cod ? via : undefined))}
        onClose={onClose}
      >
        {cod ? <PaymentChoice value={via} onChange={setVia} /> : null}
      </ConfirmDialog>
      <FailDeliverySheet
        visible={overlay?.kind === "fail"}
        customer={stop?.user.name ?? ""}
        running={actions.running}
        onClose={onClose}
        onConfirm={(reason, note) => overlay && finish(actions.fail(overlay.tripId, overlay.stop.id, reason, note))}
      />
    </>
  );
}
