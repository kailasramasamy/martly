import type { DeliveryFailureReason } from "@martly/shared/constants";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useToast } from "../../../../lib/toast-context";
import type { DeliveryPlan, PlanResult, PlanTrip, PlanWave } from "./types";

interface PlanScope {
  storeId: string;
  date: string;
  wave: PlanWave;
  setPlan: (plan: DeliveryPlan) => void;
  reload: () => void;
}

const overflowNote = (n: number) => `${n} order${n === 1 ? "" : "s"} didn't fit — add a rider or a trip`;

/** Every change a dispatcher makes to one wave; each refreshes the plan afterwards */
export function usePlanActions({ storeId, date, wave, setPlan, reload }: PlanScope) {
  const { run, running } = useAction();
  const toast = useToast();

  const after = async <R,>(fn: () => Promise<R>, message?: string) => {
    const res = await run(fn, message);
    if (res !== undefined) reload();
    return res;
  };

  const plan = async () => {
    const res = await run(() => api.post<PlanResult>("/api/v1/delivery-plan/plan", { storeId, date, ...(wave.slotId ? { slotId: wave.slotId } : {}) }));
    if (!res) return;
    setPlan(res.data.plan);
    if (res.data.overflow > 0) toast.show(overflowNote(res.data.overflow), "error");
    else toast.show(`${res.data.tripIds.length} trip${res.data.tripIds.length === 1 ? "" : "s"} planned`, "success");
  };
  const assign = (assignments: { tripId: string; riderId: string }[], message: string) =>
    after(() => api.post("/api/v1/delivery-trips/assign", { assignments }), message);

  return {
    running,
    plan,
    assign,
    assignAll: (trips: PlanTrip[]) => assign(
      trips.filter((t) => t.suggestedRiderId).map((t) => ({ tripId: t.id, riderId: t.suggestedRiderId as string })),
      "Riders assigned",
    ),
    move: (fromTripId: string, orderId: string, toTripId: string | null) =>
      after(() => api.post(`/api/v1/delivery-trips/${fromTripId}/move-order`, { orderId, toTripId }), toTripId ? "Order moved" : "Order back to unplanned"),
    fail: (tripId: string, orderId: string, reason: DeliveryFailureReason, note?: string) =>
      after(() => api.post(`/api/v1/delivery-trips/${tripId}/orders/${orderId}/fail`, { reason, ...(note ? { note } : {}) }), "Order back to the store"),
    start: (tripId: string) => after(() => api.patch(`/api/v1/delivery-trips/${tripId}/start`), "Trip started"),
    cancel: (tripId: string) => after(() => api.patch(`/api/v1/delivery-trips/${tripId}/cancel`), "Trip cancelled"),
  };
}

export type PlanActions = ReturnType<typeof usePlanActions>;
