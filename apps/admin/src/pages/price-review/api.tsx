import { useEffect, useState } from "react";
import { App } from "antd";
import { isAxiosError } from "axios";
import type { ApiResponse, PaginatedResponse, PriceReviewResult } from "@martly/shared/types";
import type { PriceReviewOutcome } from "@martly/shared/constants";
import type { PriceReviewBulkInput, PriceReviewDecision } from "@martly/shared/schemas";
import { axiosInstance } from "../../providers/data-provider";

export type ListMeta = PaginatedResponse<unknown>["meta"];
type Status = "pending" | "reviewed" | "notCarried" | "all";

export interface ItemFilters {
  status: Status;
  outcome?: PriceReviewOutcome;
  departmentId?: string;
  brand?: { value: string; label: string };
  subcategory?: { id: string; name: string };
  q: string;
  sort: "priority" | "name";
}

export const DEFAULT_FILTERS: ItemFilters = { status: "pending", q: "", sort: "priority" };

export const itemParams = (storeId: string, f: ItemFilters, page: number) => ({
  storeId,
  page,
  pageSize: 50,
  status: f.status,
  outcome: f.outcome,
  departmentId: f.departmentId,
  brandId: f.brand?.value,
  subcategoryId: f.subcategory?.id,
  q: f.q || undefined,
  sort: f.sort,
});

/** Server-paged list; `params: null` waits (no store yet), `version` refetches after an action */
export function useApiList<T>(path: string, params: object | null, version = 0) {
  const { message } = App.useApp();
  const [state, setState] = useState<{ rows: T[]; meta: ListMeta | null; loading: boolean }>({ rows: [], meta: null, loading: false });
  const key = JSON.stringify(params);

  useEffect(() => {
    const query = JSON.parse(key) as object | null;
    if (!query) {
      setState({ rows: [], meta: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    axiosInstance
      .get<PaginatedResponse<T>>(`/price-review/${path}`, { params: query })
      .then(({ data }) => {
        if (!cancelled) setState({ rows: data.data, meta: data.meta, loading: false });
      })
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        if (cancelled) return;
        message.error(err.response?.data?.message ?? "Couldn't load the price review");
        setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, key, version, message]);

  return state;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type BulkInput = DistributiveOmit<PriceReviewBulkInput, "storeId">;

/** Posts decisions and shows what happened, with an Undo for the actions that can be taken back cleanly */
export function usePriceReviewActions(storeId: string | undefined, onDone: () => void) {
  const { message } = App.useApp();

  const reopen = async (body: { storeProductIds: string[] } | { batch: string }) => {
    try {
      const { data } = await axiosInstance.post<ApiResponse<{ reopened: number }>>("/price-review/reopen", { storeId, ...body });
      message.success(`Reopened ${data.data.reopened}`);
      onDone();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't reopen");
    }
  };

  type ReopenBody = Parameters<typeof reopen>[0];
  /** `undo` names the rows to reopen; without it the call's batch is used */
  const settle = async (path: string, body: object, text: (n: number) => string, undoable: boolean, undo?: ReopenBody) => {
    try {
      const { data } = await axiosInstance.post<ApiResponse<PriceReviewResult>>(`/price-review/${path}`, { storeId, ...body });
      const { updated, batch } = data.data;
      message.success({
        content: (
          <span>
            {text(updated)}
            {undoable && <a style={{ marginLeft: 12 }} onClick={() => reopen(undo ?? { batch })}>Undo</a>}
          </span>
        ),
        duration: 6,
      });
      onDone();
      return true;
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't save");
      return false;
    }
  };

  const decide = (items: PriceReviewDecision[], undoable: boolean) =>
    settle("decide", { items }, (n) => `Saved ${n} price${n === 1 ? "" : "s"}`, undoable, { storeProductIds: items.map((i) => i.id) });

  const bulk = (input: BulkInput) => {
    const text = (n: number) =>
      input.action === "hide" ? `Hid ${n} listing${n === 1 ? "" : "s"}` : `Settled ${n} listing${n === 1 ? "" : "s"}`;
    const undo = "storeProductIds" in input.scope ? { storeProductIds: input.scope.storeProductIds } : undefined;
    return settle("bulk", input, text, input.action !== "percentOffMrp", undo);
  };

  return { decide, bulk, reopen };
}

export type PriceReviewActions = ReturnType<typeof usePriceReviewActions>;
