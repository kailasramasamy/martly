import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import type { StoreMapping } from "./types";

/** Store listings of one product, scoped by the API to the caller's stores, with in-place toggle and unmap */
export function useStoreMappings(productId: string) {
  const { run, running } = useAction();
  const [mappings, setMappings] = useState<StoreMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.getList<StoreMapping>(`/api/v1/store-products?productId=${productId}&pageSize=200`);
      setMappings(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load store listings");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (m: StoreMapping, field: "isActive" | "isFeatured", value: boolean) => {
    const ok = await run(() => api.put(`/api/v1/store-products/${m.id}`, { [field]: value }));
    if (ok) setMappings((all) => all.map((x) => (x.id === m.id ? { ...x, [field]: value } : x)));
  };

  const unmap = async (m: StoreMapping) => {
    const ok = await run(() => api.delete(`/api/v1/store-products/${m.id}`), "Removed from store");
    if (ok) setMappings((all) => all.filter((x) => x.id !== m.id));
  };

  return { mappings, loading, error, load, toggle, unmap, busy: running };
}
