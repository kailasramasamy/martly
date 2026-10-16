import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api } from "../api";
import { useToast } from "../toast-context";
import { useManageScope } from "../manage-scope-context";
import { useOrderWebSocket } from "../useOrderWebSocket";
import { formatINR } from "../../components/manage/ui/tokens";
import { toQuery } from "./query";

interface LiveState {
  pending: number;
  /** Bumped on every order change so screens can refetch */
  tick: number;
  /** One-shot request from the Today tab to open Orders on a status */
  filter: { status: string; nonce: number } | null;
}

let state: LiveState = { pending: 0, tick: 0, filter: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingOrderCount() {
  return useSyncExternalStore(subscribe, () => state.pending);
}

/** Changes whenever an order is created or moves status; add it to effect deps to refetch */
export function useOrdersTick() {
  return useSyncExternalStore(subscribe, () => state.tick);
}

export function requestOrdersFilter(status: string) {
  setState({ filter: { status, nonce: (state.filter?.nonce ?? 0) + 1 } });
}

export function useOrdersFilterRequest() {
  return useSyncExternalStore(subscribe, () => state.filter);
}

/**
 * Mount once in the Manage tab layout (`enabled` when the member can view orders). Owns the order WebSocket, keeps the PENDING count
 * for the current store scope, and toasts when a new order lands while the app is open.
 */
export function useLiveOrders(enabled: boolean) {
  const { storeId } = useManageScope();
  const toast = useToast();

  const refreshPending = useCallback(() => {
    if (!enabled) return;
    api.getList(`/api/v1/orders${toQuery({ status: "PENDING", pageSize: 1, storeId })}`)
      .then((res) => setState({ pending: res.meta.total }))
      .catch(() => undefined);
  }, [storeId, enabled]);

  const announceNewOrder = useCallback((orderId: string) => {
    if (!enabled) return;
    api.get<{ totalAmount: string; storeId: string }>(`/api/v1/orders/${orderId}`)
      .then((res) => {
        if (storeId && res.data.storeId !== storeId) return;
        toast.show(`New order ${formatINR(Number(res.data.totalAmount))}`, "success");
      })
      .catch(() => undefined);
  }, [storeId, toast, enabled]);

  useOrderWebSocket({
    onOrdersChanged: (orderId, status) => {
      setState({ tick: state.tick + 1 });
      refreshPending();
      if (status === "PENDING") announceNewOrder(orderId);
    },
  });

  useEffect(() => {
    refreshPending();
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      setState({ tick: state.tick + 1 });
      refreshPending();
    });
    return () => sub.remove();
  }, [refreshPending]);

  return usePendingOrderCount();
}
