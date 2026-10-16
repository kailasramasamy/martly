import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { NEXT_ACTION_LABELS, permittedNextStatuses } from "@martly/shared/order-flow";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useDispatchAccess } from "./use-dispatch-access";
import type { MenuOrder } from "./types";

/** State behind the board's order menu: the next step, the delivered confirm, cancel, and picking a rider to send it out */
export function useOrderMenu(order: MenuOrder | null, onClose: () => void, onChanged: () => void) {
  const router = useRouter();
  const { user } = useAuth();
  const { run, running } = useAction();
  const { canDispatch } = useDispatchAccess();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmFinal, setConfirmFinal] = useState(false);
  const [picking, setPicking] = useState(false);
  const [riderId, setRiderId] = useState<string | null>(null);
  useEffect(() => { setConfirmFinal(false); setPicking(false); setRiderId(null); }, [order?.id]);

  const allowed = order ? permittedNextStatuses(user, order.status, order.fulfillmentType) : [];
  const next = allowed.find((s) => s !== "CANCELLED");
  const meta = next ? NEXT_ACTION_LABELS[next] : null;
  const nextLabel = next === "OUT_FOR_DELIVERY" ? "Send out with rider" : meta ? (order?.fulfillmentType === "PICKUP" && meta.pickupLabel) || meta.label : "";

  const done = (res: unknown) => {
    setConfirmCancel(false);
    if (res) { onClose(); onChanged(); }
  };
  const setStatus = async (status: string, message: string, note?: string) => {
    if (order) done(await run(() => api.patch(`/api/v1/orders/${order.id}/status`, { status, note }), message));
  };

  return {
    running, next, nextLabel, confirmFinal, confirmCancel, setConfirmCancel, picking, setPicking, riderId, setRiderId, setStatus,
    canCancel: allowed.includes("CANCELLED"),
    /** Sent out before riders were required: still on the road with nobody assigned */
    riderless: canDispatch && order?.status === "OUT_FOR_DELIVERY" && !order.deliveryTripId,
    advance: () => {
      if (next === "OUT_FOR_DELIVERY") setPicking(true);
      else if (next === "DELIVERED" && !confirmFinal) setConfirmFinal(true);
      else if (next) setStatus(next, "Order updated");
    },
    sendOut: async () => {
      if (!order || !riderId) return;
      done(await run(() => api.post("/api/v1/delivery-trips", { storeId: order.storeId, riderId, orderIds: [order.id], start: true }), "Sent out for delivery"));
    },
    openOrder: () => {
      const id = order?.id;
      onClose();
      if (id) router.push(`/manage/orders/${id}`);
    },
  };
}
