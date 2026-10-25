import { useCallback, useEffect, useState } from "react";
import type { MonthlyListQuote } from "@martly/shared/types";
import { api, ApiError } from "../../lib/api";
import type { OrderLine } from "./use-month-plan";

export type QuickOrder =
  | { phase: "quoting" }
  | { phase: "quoted"; quote: MonthlyListQuote }
  | { phase: "placing"; quote: Extract<MonthlyListQuote, { ready: true }> }
  | { phase: "placed"; orderId: string }
  | { phase: "failed"; message: string | null };

/** "Order as is": the server's quote for this month's lines, then the order placed with it, paid on delivery */
export function useQuickOrder(listId: string, storeId: string, lines: OrderLine[], open: boolean) {
  const [state, setState] = useState<QuickOrder>({ phase: "quoting" });
  const linesKey = lines.map((l) => `${l.sp.id}:${l.quantity}`).join(",");

  useEffect(() => {
    if (!open) return;
    let live = true;
    setState({ phase: "quoting" });
    const body = { lines: linesKey.split(",").filter(Boolean).map((e) => ({ storeProductId: e.split(":")[0], quantity: Number(e.split(":")[1]) })) };
    if (body.lines.length === 0) {
      setState({ phase: "quoted", quote: { ready: false, reason: "NOTHING_IN_STOCK" } });
      return;
    }
    api.post<MonthlyListQuote>(`/api/v1/monthly-list/${listId}/quick-order`, body)
      .then((res) => live && setState({ phase: "quoted", quote: res.data }))
      .catch((err: unknown) => {
        if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
        if (live) setState({ phase: "failed", message: err instanceof ApiError ? err.message : null });
      });
    return () => {
      live = false;
    };
  }, [open, listId, linesKey]);

  const place = useCallback(async () => {
    if (state.phase !== "quoted" || !state.quote.ready) return;
    const quote = state.quote;
    setState({ phase: "placing", quote });
    const slot = quote.delivery.kind === "SLOT" ? { deliverySlotId: quote.delivery.slotId, scheduledDate: quote.delivery.date } : {};
    try {
      const res = await api.post<{ id: string }>("/api/v1/orders", {
        storeId, fulfillmentType: "DELIVERY", paymentMethod: "COD", useWallet: false, useLoyaltyPoints: false,
        addressId: quote.address.id, items: quote.lines, monthlyListId: listId, ...slot,
      });
      setState({ phase: "placed", orderId: res.data.id });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      setState({ phase: "failed", message: err instanceof ApiError ? err.message : null });
    }
  }, [state, storeId, listId]);

  return { state, place };
}
