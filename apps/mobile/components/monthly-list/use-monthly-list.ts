import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { CreateMonthlyListInput, UpdateMonthlyListInput } from "@martly/shared/schemas";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { MonthlyList } from "../../lib/types";

const BASE = "/api/v1/monthly-list";
// Quantity taps settle before the list is saved
const SAVE_DELAY_MS = 600;

export type ListLine = { productId: string; variantId: string; quantity: number };
/** A change to the lines, applied to the list as the server last returned it */
export type LinesEdit = (lines: ListLine[]) => ListLine[];
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
  // The list as the server last returned it; the screen may be ahead of it with quantity taps not yet saved
  const saved = useRef<MonthlyList | null>(null);
  const show = useCallback((list: MonthlyList) => {
    saved.current = list;
    setState({ kind: "ready", list });
  }, []);

  const reload = useCallback(async () => {
    if (!storeId) return setState({ kind: "none" });
    try {
      show((await api.get<MonthlyList>(`${BASE}?storeId=${storeId}`)).data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return setState({ kind: "none" });
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      setState({ kind: "failed" });
    }
  }, [storeId, show]);
  useEffect(() => {
    void reload();
  }, [reload]);
  const apply = useCallback(async (request: Promise<{ data: MonthlyList }>, notFound?: string) => {
    try {
      show((await request).data);
      return true;
    } catch (err) {
      failed(err, notFound);
      return false;
    }
  }, [failed, show]);

  // Starting from an order fails with a 404 when there's no recent one at the store
  const create = useCallback((input: Omit<CreateMonthlyListInput, "storeId">) =>
    storeId ? apply(api.post<MonthlyList>(BASE, { ...input, storeId }), t.noOrder) : Promise.resolve(false), [storeId, apply, t]);

  const saveSettings = useCallback((id: string, input: UpdateMonthlyListInput) =>
    apply(api.put<MonthlyList>(`${BASE}/${id}`, input)), [apply]);

  const { saveLines, setQuantity } = useLineSaves(state, setState, saved, apply);
  return { state, reload, create, saveSettings, saveLines, setQuantity };
}

/**
 * Saves to the lines run one at a time, each applied to the list the server last returned, so quick taps (switch a pack,
 * then remove a line) build on each other instead of the last one undoing the first. Quantity taps wait until they stop
 * and ride along with the next save.
 */
function useLineSaves(
  state: ListState, setState: (s: ListState) => void, saved: RefObject<MonthlyList | null>,
  apply: (r: Promise<{ data: MonthlyList }>) => Promise<boolean>,
) {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const quantities = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const saveLines = useCallback((id: string, edit: LinesEdit) => {
    if (timer.current) clearTimeout(timer.current);
    const run = () => {
      if (!saved.current) return Promise.resolve(false);
      const lines = linesOf(saved.current).map((l) => ({ ...l, quantity: quantities.current.get(l.variantId) ?? l.quantity }));
      quantities.current.clear();
      return apply(api.put<MonthlyList>(`${BASE}/${id}/items`, { items: edit(lines) }));
    };
    const next = queue.current.then(run, run);
    queue.current = next;
    return next;
  }, [saved, apply]);

  // A quantity shows at once and is saved once the taps stop
  const setQuantity = useCallback((itemId: string, quantity: number) => {
    if (state.kind !== "ready") return;
    const list = { ...state.list, items: state.list.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)) };
    const variantId = state.list.items.find((i) => i.id === itemId)?.variantId;
    if (variantId) quantities.current.set(variantId, quantity);
    setState({ kind: "ready", list });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveLines(list.id, (lines) => lines), SAVE_DELAY_MS);
  }, [state, setState, saveLines]);

  return { saveLines, setQuantity };
}
