import { useCallback, useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useOrderWebSocket } from "../../../lib/useOrderWebSocket";
import { ORDER_STATUS, PAYMENT_STATUS } from "../ui/tokens";
import type { OrderDetail } from "./types";

/** Order detail with live updates plus the status and payment mutations from the web admin */
export function useOrderDetail(orderId: string | undefined) {
  const resource = useResource<OrderDetail>(orderId ? `/api/v1/orders/${orderId}` : null);
  const { reload } = resource;
  const [refreshing, setRefreshing] = useState(false);
  const { run, running } = useAction();

  useOrderWebSocket({
    orderId,
    enabled: !!orderId,
    onOrderUpdated: () => { reload(); },
    onOrdersChanged: (changedId) => { if (changedId === orderId) reload(); },
  });

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const setStatus = async (status: string) => {
    const ok = await run(() => api.patch(`/api/v1/orders/${orderId}/status`, { status }), `Order marked ${ORDER_STATUS[status]?.label ?? status}`);
    if (ok) await reload();
  };

  const setPaymentStatus = async (paymentStatus: string, note: string) => {
    const ok = await run(
      () => api.patch(`/api/v1/orders/${orderId}/payment-status`, { paymentStatus, ...(note ? { note } : {}) }),
      `Payment marked ${PAYMENT_STATUS[paymentStatus]?.label ?? paymentStatus}`,
    );
    if (ok) await reload();
    return !!ok;
  };

  return { ...resource, refreshing, refresh, running, setStatus, setPaymentStatus };
}
