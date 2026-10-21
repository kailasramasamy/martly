import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { RecentList, ShoppingListItem } from "@martly/shared/types";
import { api, ApiError } from "./api";
import { useAuth } from "./auth-context";
import { useToast } from "./toast-context";
import { useStrings } from "./i18n/use-strings";

const BASE = "/api/v1/shopping-list";

/** Network and API failures become a toast; anything else is a bug and is rethrown */
function useFailureToast() {
  const toast = useToast();
  const t = useStrings("shoppingList");
  return useCallback((err: unknown) => {
    if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
    toast.show(err instanceof ApiError ? err.message : t.saveFailed, "error");
  }, [toast, t]);
}

/** The open list and the lists from earlier shops, loaded whenever the screen shows */
function useListData(failed: (err: unknown) => void) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [recent, setRecent] = useState<RecentList[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isAuthenticated) return setLoading(false);
    try {
      const [list, past] = await Promise.all([api.get<ShoppingListItem[]>(BASE), api.get<RecentList[]>(`${BASE}/recent`)]);
      setItems(list.data);
      setRecent(past.data);
    } catch (err) {
      failed(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, failed]);
  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));
  return { items, setItems, recent, loading };
}

/** Lists from earlier shops (any list the customer built a cart from, spoken or kept), loaded whenever the screen shows */
export function useRecentLists() {
  const { isAuthenticated } = useAuth();
  const failed = useFailureToast();
  const [recent, setRecent] = useState<RecentList[]>([]);
  useFocusEffect(useCallback(() => {
    if (isAuthenticated) api.get<RecentList[]>(`${BASE}/recent`).then((res) => setRecent(res.data), failed);
  }, [isAuthenticated, failed]));
  return recent;
}

/** The customer's running list (kept on the server, so it survives reinstalls), and lists to start it from */
export function useShoppingList() {
  const failed = useFailureToast();
  const { items, setItems, recent, loading } = useListData(failed);

  const add = useCallback(async (text: string) => {
    try {
      const { data } = await api.post<ShoppingListItem>(BASE, { text });
      setItems((prev) => [...prev, data]);
    } catch (err) {
      failed(err);
    }
  }, [failed]);

  /** Several items at once (a past list); ones already on the list are skipped by the server */
  const addMany = useCallback(async (texts: string[]) => {
    try {
      const { data } = await api.post<ShoppingListItem[]>(`${BASE}/bulk`, { texts });
      setItems((prev) => [...prev, ...data]);
    } catch (err) {
      failed(err);
    }
  }, [failed]);

  const edit = useCallback(async (id: string, text: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text } : i)));
    await api.patch(`${BASE}/${id}`, { text }).catch(failed);
  }, [failed]);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await api.delete(`${BASE}/${id}`).catch(failed);
  }, [failed]);

  /** Ticks off items once they're in the cart */
  const done = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    await api.post(`${BASE}/done`, { ids }).catch(failed);
  }, [failed]);

  return { items, recent, loading, add, addMany, edit, remove, done };
}
