import { useEffect, useState, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import type { StoreProduct } from "./types";

const STORAGE_KEY = "martly_recently_viewed";
const MAX_VIEWED = 12;

// Product ids, newest first. Kept on the device so guests get it too; shared by every screen through subscribe()
let viewed: string[] = [];
const listeners = new Set<() => void>();

function set(next: string[]) {
  viewed = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// Views recorded before the saved list finished loading stay in front of it
AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
  if (!raw) return;
  const saved = (JSON.parse(raw) as string[]).filter((id) => !viewed.includes(id));
  set([...viewed, ...saved].slice(0, MAX_VIEWED));
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const recordProductView = (productId: string) => set([productId, ...viewed.filter((id) => id !== productId)].slice(0, MAX_VIEWED));

export const clearRecentlyViewed = () => set([]);

/** Recently viewed products this store sells, newest first, with live price and stock */
export function useRecentlyViewed(storeId: string | undefined) {
  const ids = useSyncExternalStore(subscribe, () => viewed);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const key = ids.join(",");

  useEffect(() => {
    if (!storeId || !key) return setProducts([]);
    let live = true;
    api.getList<StoreProduct>(`/api/v1/stores/${storeId}/products?productIds=${key}&pageSize=100`).then((res) => {
      if (!live) return;
      const order = new Map(key.split(",").map((id, i) => [id, i]));
      setProducts([...res.data].sort((a, b) => (order.get(a.product.id) ?? 0) - (order.get(b.product.id) ?? 0)));
    }).catch(() => live && setProducts([]));
    return () => { live = false; };
  }, [storeId, key]);

  return products;
}
