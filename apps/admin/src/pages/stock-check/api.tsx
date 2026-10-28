import { useEffect, useState } from "react";
import { App } from "antd";
import { isAxiosError } from "axios";
import type { ApiResponse, PaginatedResponse, StockCheckResult } from "@martly/shared/types";
import type { StockCheckScope } from "@martly/shared/schemas";
import { axiosInstance } from "../../providers/data-provider";

export type ListMeta = PaginatedResponse<unknown>["meta"];

const SIZES_PER_CALL = 200;

export const count = (n: number) => n.toLocaleString("en-IN");

/** Reads a stock-check endpoint; `params: null` waits (nothing picked yet), `version` refetches after a write */
export function useStockGet<T>(path: string, params: object | null, version: number) {
  const { message } = App.useApp();
  const [state, setState] = useState<{ data: T | null; meta: ListMeta | null; loading: boolean }>({ data: null, meta: null, loading: false });
  const key = JSON.stringify(params);

  useEffect(() => {
    const query = JSON.parse(key) as object | null;
    if (!query) {
      setState({ data: null, meta: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    axiosInstance
      .get<PaginatedResponse<T>>(`/stock-check/${path}`, { params: query })
      .then(({ data }) => !cancelled && setState({ data: data.data as T, meta: data.meta ?? null, loading: false }))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        if (cancelled) return;
        message.error(err.response?.data?.message ?? "Couldn't load the stock check");
        setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, key, version, message]);

  return state;
}

interface Call {
  path: "decide" | "sizes";
  body: object;
}

/** Posts stock-check writes and offers an Undo that takes every call of the action back */
export function useStockCheckActions(storeId: string | undefined, onDone: () => void) {
  const { message } = App.useApp();

  const undo = async (batches: string[]) => {
    try {
      const results = await Promise.all(batches.map((batch) => axiosInstance.post<ApiResponse<{ undone: number }>>("/stock-check/undo", { storeId, batch })));
      message.success(`Undone: ${count(results.reduce((sum, r) => sum + r.data.data.undone, 0))} listings back to how they were`);
      onDone();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't undo");
    }
  };

  const run = async (calls: Call[], text: (n: number) => string) => {
    try {
      const results = [];
      for (const call of calls) {
        const { data } = await axiosInstance.post<ApiResponse<StockCheckResult>>(`/stock-check/${call.path}`, { storeId, ...call.body });
        results.push(data.data);
      }
      const batches = results.filter((r) => r.updated > 0).map((r) => r.batch);
      message.success({
        content: (
          <span>
            {text(results.reduce((sum, r) => sum + r.updated, 0))}
            {batches.length > 0 && <a style={{ marginLeft: 12 }} onClick={() => undo(batches)}>Undo</a>}
          </span>
        ),
        duration: 8,
      });
      onDone();
      return true;
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't save");
      return false;
    }
  };

  const decide = (scopes: StockCheckScope[], carried: boolean) =>
    run(scopes.map((scope) => ({ path: "decide", body: { scope, carried } })), (n) => `${count(n)} product${n === 1 ? "" : "s"} marked ${carried ? "carried" : "not sold"}`);

  const saveSizes = (items: { id: string; carried: boolean }[]) => {
    const calls: Call[] = [];
    for (let i = 0; i < items.length; i += SIZES_PER_CALL) calls.push({ path: "sizes", body: { items: items.slice(i, i + SIZES_PER_CALL) } });
    return run(calls, (n) => `Saved ${count(n)} size${n === 1 ? "" : "s"}`);
  };

  return { decide, saveSizes };
}

export type StockCheckActions = ReturnType<typeof useStockCheckActions>;
