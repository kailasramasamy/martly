import { useCallback, useState } from "react";
import { message } from "antd";
import type { DeliveryFailureReason } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import type { DeliveryPlan, Wave } from "./types";

interface Options {
  storeId: string | null;
  date: string;
  setPlan: (plan: DeliveryPlan) => void;
  reload: () => Promise<void>;
}

type Runner = (id: string, call: () => Promise<void>, fallback: string) => Promise<boolean>;

/** Runs a mutation with `busyId` set to the trip, wave or order being worked on; resolves true on success */
function useRunner() {
  const [busyId, setBusyId] = useState<string | null>(null);
  const run: Runner = useCallback(async (id, call, fallback) => {
    setBusyId(id);
    try {
      await call();
      return true;
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? fallback);
      return false;
    } finally {
      setBusyId(null);
    }
  }, []);
  return { busyId, run };
}

function useTripActions(run: Runner, { date, reload }: Pick<Options, "date" | "reload">) {
  const patchTrip = (tripId: string, action: "start" | "cancel", success: string) =>
    run(tripId, async () => {
      await axiosInstance.patch(`/delivery-trips/${tripId}/${action}`);
      message.success(success);
      await reload();
    }, `Failed to ${action} trip`);

  const moveOrder = (tripId: string, orderId: string, toTripId: string | null) =>
    run(tripId, async () => {
      await axiosInstance.post(`/delivery-trips/${tripId}/move-order`, { orderId, toTripId });
      await reload();
    }, "Failed to move order");

  const deliver = (orderId: string) =>
    run(orderId, async () => {
      await axiosInstance.patch(`/orders/${orderId}/status`, { status: "DELIVERED" });
      message.success("Marked delivered");
      await reload();
    }, "Failed to mark delivered");

  const failDelivery = (tripId: string, orderId: string, reason: DeliveryFailureReason, note: string) =>
    run(orderId, async () => {
      await axiosInstance.post(`/delivery-trips/${tripId}/orders/${orderId}/fail`, { reason, note: note || undefined });
      message.success("Marked as not delivered. The order is back in the unplanned pool.");
      await reload();
    }, "Failed to record the failed delivery");

  const setWorking = (slotId: string, riderId: string, working: boolean) =>
    run(riderId, async () => {
      await axiosInstance.put(`/delivery-plan/slots/${slotId}/roster/override`, { riderId, date, working });
      await reload();
    }, "Failed to update today's riders");

  return { patchTrip, moveOrder, deliver, failDelivery, setWorking };
}

/** Every mutation on the wave planner; `busyId` is the trip or wave key being worked on */
export function usePlanActions({ storeId, date, setPlan, reload }: Options) {
  const { busyId, run } = useRunner();
  const [overflow, setOverflow] = useState<Record<string, number>>({});
  const tripActions = useTripActions(run, { date, reload });

  const planWave = (wave: Wave, key: string) =>
    run(key, async () => {
      const res = await axiosInstance.post("/delivery-plan/plan", { storeId, date, slotId: wave.slotId ?? undefined });
      const { overflow: over, plan } = res.data.data;
      setPlan(plan);
      setOverflow((o) => ({ ...o, [key]: over }));
      message.success("Trips planned");
    }, "Failed to plan trips");

  const assign = (assignments: { tripId: string; riderId: string }[], id: string) =>
    run(id, async () => {
      await axiosInstance.post("/delivery-trips/assign", { assignments });
      message.success(assignments.length > 1 ? "Riders assigned" : "Rider assigned");
      await reload();
    }, "Failed to assign");

  return { busyId, overflow, planWave, assign, ...tripActions };
}
