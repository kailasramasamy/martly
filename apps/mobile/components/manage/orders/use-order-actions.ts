import { useCallback } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ORDER_STATUS } from "../ui/tokens";

interface BulkResult {
  updated: number;
  skipped: number;
  errors: { orderId: string; reason: string }[];
}

/** Status mutations for order lists; `onDone` runs after a successful change so the caller can refetch */
export function useOrderActions(onDone: () => void) {
  const { run, running } = useAction();
  const toast = useToast();

  const setStatus = useCallback(async (orderId: string, status: string) => {
    const ok = await run(() => api.patch(`/api/v1/orders/${orderId}/status`, { status }), `Order marked ${ORDER_STATUS[status]?.label ?? status}`);
    if (ok) onDone();
    return !!ok;
  }, [run, onDone]);

  const bulkSetStatus = useCallback(async (orderIds: string[], status: string) => {
    const res = await run(() => api.post<BulkResult>("/api/v1/orders/bulk-status", { orderIds, status }));
    if (!res) return false;
    const { updated, skipped } = res.data;
    toast.show(skipped ? `${updated} updated, ${skipped} skipped` : `${updated} orders updated`, skipped ? "default" : "success");
    onDone();
    return true;
  }, [run, toast, onDone]);

  return { setStatus, bulkSetStatus, running };
}
