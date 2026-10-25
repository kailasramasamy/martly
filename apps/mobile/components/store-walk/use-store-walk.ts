import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useCart, type CartItem } from "../../lib/cart-context";
import type { WalkAisle, WalkRoute } from "../../lib/types";
import { walkSession } from "../../lib/walk-session";

export type WalkPhase = "route" | "aisle" | "department" | "done";
type AisleEntry = WalkAisle | "error";

// Aisles fetched as they come up, the next one ahead of time so "Next" never waits
function useAisles(storeId: string | undefined) {
  const [aisles, setAisles] = useState<Map<string, AisleEntry>>(new Map());
  const requested = useRef(new Set<string>());
  const load = useCallback((categoryId: string, retry = false) => {
    if (!storeId || (requested.current.has(categoryId) && !retry)) return;
    requested.current.add(categoryId);
    api.get<WalkAisle>(`/api/v1/store-walk/${storeId}/aisles/${categoryId}`)
      .then((res) => res.data)
      .catch((): AisleEntry => "error")
      .then((entry) => setAisles((m) => new Map(m).set(categoryId, entry)));
  }, [storeId]);
  return { aisles, load };
}

// The department's route, re-asked with the cart as it is now (covered aisles, due items still missing)
function useRoute(storeId: string | undefined, items: CartItem[]) {
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [failed, setFailed] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const load = useCallback(async (departmentId?: string) => {
    if (!storeId) return null;
    setFailed(false);
    try {
      const res = await api.post<WalkRoute>(`/api/v1/store-walk/${storeId}/route`, {
        departmentId, cartStoreProductIds: itemsRef.current.map((i) => i.storeProductId),
      });
      setRoute(res.data);
      return res.data;
    } catch {
      setFailed(true);
      return null;
    }
  }, [storeId]);
  return { route, failed, load };
}

/** Lines the walk added, or added to: how many and what they cost, against the cart when the walk began */
function useAdded(items: CartItem[]) {
  const [before] = useState(() => new Map(items.map((i) => [i.storeProductId, i.quantity])));
  return useMemo(() => items
    .map((item) => ({ item, added: item.quantity - (before.get(item.storeProductId) ?? 0) }))
    .filter((l) => l.added > 0), [items, before]);
}

/**
 * The walk through the store: one department's aisles in shelf order, one at a time. From the cart or checkout
 * (`skipCovered`) it leaves out aisles the cart already has something from, unless an item there is due.
 */
export function useStoreWalk(storeId: string | undefined, { skipCovered, departmentId }: { skipCovered: boolean; departmentId?: string }) {
  const { items } = useCart();
  const { route, failed, load: loadRoute } = useRoute(storeId, items);
  const { aisles, load: loadAisle } = useAisles(storeId);
  const [phase, setPhase] = useState<WalkPhase>(skipCovered ? "aisle" : "route");
  const [index, setIndex] = useState(0);
  // Aisles the shopper has walked past, by category
  const [walked, setWalked] = useState<Set<string>>(new Set());
  const [walkedDepartments, setWalkedDepartments] = useState<string[]>([]);
  const added = useAdded(items);

  useEffect(() => { loadRoute(departmentId); }, [loadRoute, departmentId]);

  const stops = useMemo(() => {
    const all = route?.stops ?? [];
    const open = skipCovered ? all.filter((s) => !s.inCart || s.dueCount > 0) : all;
    return open.length > 0 ? open : all;
  }, [route, skipCovered]);
  const stop = stops[index];

  useEffect(() => {
    if (phase !== "aisle" || !stop) return;
    loadAisle(stop.categoryId);
    if (stops[index + 1]) loadAisle(stops[index + 1].categoryId);
  }, [phase, stop, stops, index, loadAisle]);

  const leave = useCallback(() => {
    if (!stop || !route) return;
    walkSession.walked = true;
    setWalked((w) => new Set(w).add(stop.categoryId));
    if (index + 1 < stops.length) return setIndex(index + 1);
    setWalkedDepartments((d) => (d.includes(route.departmentId) ? d : [...d, route.departmentId]));
    setPhase("department");
  }, [stop, route, index, stops.length]);

  const toRoute = useCallback(() => setPhase("route"), []);

  const switchDepartment = useCallback(async (id: string, walkNow: boolean) => {
    if (await loadRoute(id)) {
      setIndex(0);
      setPhase(walkNow ? "aisle" : "route");
    }
  }, [loadRoute]);

  return {
    route, failed, retry: () => loadRoute(route?.departmentId ?? departmentId), stops, stop, index, phase, walked, aisles, added,
    walkedDepartments, aisle: stop ? aisles.get(stop.categoryId) : undefined,
    retryAisle: () => stop && loadAisle(stop.categoryId, true),
    start: () => { setIndex(0); setPhase("aisle"); },
    leave, jump: (i: number) => { setIndex(i); setPhase("aisle"); }, switchDepartment, finish: () => setPhase("done"),
    toRoute,
  };
}

export type StoreWalk = ReturnType<typeof useStoreWalk>;
