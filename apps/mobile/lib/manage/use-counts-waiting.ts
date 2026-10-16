import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api } from "../api";
import { useManageScope } from "../manage-scope-context";
import { useStockAccess } from "../../components/manage/stock/use-stock-access";
import { toQuery } from "./query";

// Stock counts waiting on this member, for the More tab badge
let waiting = 0;
let refresh: () => void = () => undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCountsWaiting() {
  return useSyncExternalStore(subscribe, () => waiting);
}

/** Re-check after a count changes hands (submitted, sent for recount, recounted, approved) */
export function refreshCountsWaiting() {
  refresh();
}

/** Which counts need this member: approvers review submitted ones, counters redo ones sent back for recount */
export function useWaitingCountStatus(): "SUBMITTED" | "RECOUNT" | null {
  const { canApprove, canCount } = useStockAccess();
  return canApprove ? "SUBMITTED" : canCount ? "RECOUNT" : null;
}

/** Mount once in the Manage tab layout: keeps the waiting-count badge current for the store scope */
export function useCountsWaitingSync() {
  const { storeId } = useManageScope();
  const status = useWaitingCountStatus();

  const load = useCallback(() => {
    if (!status) return;
    api.getList(`/api/v1/stock/counts${toQuery({ status, storeId, pageSize: 1 })}`)
      .then((res) => {
        waiting = res.meta.total;
        listeners.forEach((l) => l());
      })
      .catch(() => undefined);
  }, [status, storeId]);

  useEffect(() => {
    refresh = load;
    load();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(); });
    return () => sub.remove();
  }, [load]);
}
