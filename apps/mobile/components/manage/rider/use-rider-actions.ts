import type { DeliveryFailureReason, RefuseReason } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";

export interface RefusedLine {
  orderItemId: string;
  quantity: number;
  reason: RefuseReason;
}

/** What a rider does on a trip; each refreshes the day afterwards and resolves true when it worked */
export function useRiderActions(reload: () => void) {
  const { run, running } = useAction();

  const after = async <R,>(fn: () => Promise<R>, message: string) => {
    const res = await run(fn, message);
    if (res !== undefined) reload();
    return res !== undefined;
  };

  return {
    running,
    start: (tripId: string) => after(() => api.patch(`/api/v1/delivery-trips/${tripId}/start`), "Trip started"),
    // COD stops say how the customer paid: cash (the default) or UPI straight to the store
    deliver: async (orderId: string, collectedVia: "CASH" | "UPI" | undefined, refused: RefusedLine[], collectedPickupIds: string[]) => {
      const delivered = await after(
        () => api.patch(`/api/v1/orders/${orderId}/status`, { status: "DELIVERED", ...(collectedVia ? { collectedVia } : {}), ...(refused.length ? { refused } : {}) }),
        "Delivered",
      );
      if (delivered) await Promise.all(collectedPickupIds.map((id) => run(() => api.post(`/api/v1/return-requests/${id}/collect`, { orderId }))));
      return delivered;
    },
    fail: (tripId: string, orderId: string, reason: DeliveryFailureReason, note?: string) =>
      after(() => api.post(`/api/v1/delivery-trips/${tripId}/orders/${orderId}/fail`, { reason, ...(note ? { note } : {}) }), "Marked as not delivered"),
  };
}
