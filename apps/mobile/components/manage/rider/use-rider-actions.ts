import type { DeliveryFailureReason } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";

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
    deliver: (orderId: string, collectedVia?: "CASH" | "UPI") =>
      after(() => api.patch(`/api/v1/orders/${orderId}/status`, { status: "DELIVERED", ...(collectedVia ? { collectedVia } : {}) }), "Delivered"),
    fail: (tripId: string, orderId: string, reason: DeliveryFailureReason, note?: string) =>
      after(() => api.post(`/api/v1/delivery-trips/${tripId}/orders/${orderId}/fail`, { reason, ...(note ? { note } : {}) }), "Marked as not delivered"),
  };
}
