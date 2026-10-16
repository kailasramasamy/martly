import { useState } from "react";
import { useRouter } from "expo-router";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { handoverNote } from "@martly/shared/order-flow";
import { AssignRiderSheet } from "../delivery/AssignRiderSheet";
import { actionLabel } from "./order-flow";

interface StepOrder {
  id: string;
  storeId: string;
  fulfillmentType: string;
  totalAmount: string;
  paymentMethod?: string;
  paymentStatus?: string;
  walletAmountUsed?: string | null;
  loyaltyPointsUsed?: number | null;
}

/**
 * Moves an order to its next step. Marking it delivered (or picked up) completes payment, stock and loyalty, so it asks first;
 * sending it out needs a rider, so it opens the rider picker. Other steps go straight through.
 * Returns `advance` to call instead of the raw status change, and the overlays to render.
 */
export function useAdvanceStep<T extends StepOrder>(apply: (order: T, status: string) => unknown, onSentOut: () => void, running?: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<{ order: T; status: string } | null>(null);
  const [sendOut, setSendOut] = useState<T | null>(null);

  const advance = (order: T, status: string) => {
    if (status === "DELIVERED") setPending({ order, status });
    else if (status === "OUT_FOR_DELIVERY") setSendOut(order);
    else apply(order, status);
  };

  const label = pending ? actionLabel(pending.status, pending.order.fulfillmentType) : "";
  const overlays = (
    <>
      <ConfirmDialog
        visible={!!pending}
        title={pending ? `${label} #${pending.order.id.slice(0, 8)}?` : ""}
        message={pending ? handoverNote(pending.order) : ""}
        confirmLabel={label || "Confirm"}
        cancelLabel="Not yet"
        confirmVariant="primary"
        running={running}
        onConfirm={async () => {
          if (!pending) return;
          await apply(pending.order, pending.status);
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
      {sendOut && (
        <AssignRiderSheet
          visible
          start
          storeId={sendOut.storeId}
          orderIds={[sendOut.id]}
          onClose={() => setSendOut(null)}
          onCreated={() => { setSendOut(null); onSentOut(); }}
          onManageRiders={() => { setSendOut(null); router.push(`/manage/riders?storeId=${sendOut.storeId}`); }}
        />
      )}
    </>
  );
  return { advance, overlays };
}
