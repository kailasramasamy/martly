import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateMonthlyListInput, UpdateMonthlyListInput } from "@martly/shared/schemas";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { MonthlyList } from "../../lib/types";

const BASE = "/api/v1/monthly-list";
// Quantity taps settle before the list is saved
const SAVE_DELAY_MS = 600;

export type ListLine = { productId: string; variantId: string; quantity: number };
export type ListState = { kind: "loading" } | { kind: "failed" } | { kind: "none" } | { kind: "ready"; list: MonthlyList };

/** Network and API failures become a toast; anything else is a bug and is rethrown */
function useFailureToast() {
  const toast = useToast();
  const t = useStrings("monthlyList");
  return useCallback((err: unknown, notFound?: string) => {
    if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
    const message = err instanceof ApiError ? (err.status === 404 && notFound) || err.message : t.saveFailed;
    toast.show(message, "error");
  }, [toast, t]);
}

export const linesOf = (list: MonthlyList): ListLine[] =>
  list.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));

/** The shopper's monthly list at a store, with saving for its settings and lines (quantity taps saved together) */
export function useMonthlyList(storeId: string | undefined) {
  const t = useStrings("monthlyList");
  const failed = useFailureToast();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    if (!storeId) return setState({ kind: "none" });
    try {
      const res = await api.get<MonthlyList>(`${BASE}?storeId=${storeId}`);
      setState({ kind: "ready", list: res.data });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return setState({ kind: "none" });
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      setState({ kind: "failed" });
    }
  }, [storeId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const apply = useCallback(async (request: Promise<{ data: MonthlyList }>, notFound?: string) => {
    try {
      setState({ kind: "ready", list: (await request).data });
      return true;
    } catch (err) {
      failed(err, notFound);
      return false;
    }
  }, [failed]);

  // Starting from an order fails with a 404 when there's no recent one at the store
  const create = useCallback((input: Omit<CreateMonthlyListInput, "storeId">) =>
    storeId ? apply(api.post<MonthlyList>(BASE, { ...input, storeId }), t.noOrder) : Promise.resolve(false), [storeId, apply, t]);

  const saveSettings = useCallback((id: string, input: UpdateMonthlyListInput) =>
    apply(api.put<MonthlyList>(`${BASE}/${id}`, input)), [apply]);

  const saveLines = useCallback((id: string, items: ListLine[]) => {
    if (timer.current) clearTimeout(timer.current);
    return apply(api.put<MonthlyList>(`${BASE}/${id}/items`, { items }));
  }, [apply]);

  // A quantity shows at once and is saved once the taps stop
  const setQuantity = useCallback((itemId: string, quantity: number) => {
    if (state.kind !== "ready") return;
    const list = { ...state.list, items: state.list.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)) };
    setState({ kind: "ready", list });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void apply(api.put<MonthlyList>(`${BASE}/${list.id}/items`, { items: linesOf(list) })), SAVE_DELAY_MS);
  }, [state, apply]);

  return { state, reload, create, saveSettings, saveLines, setQuantity };
}
