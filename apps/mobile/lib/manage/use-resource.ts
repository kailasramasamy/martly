import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

/** Fetch a single `ApiResponse<T>` resource; pass `null` to skip (e.g. "create" mode). */
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    setError(null);
    try {
      const res = await api.get<T>(path);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setLoading(!!path);
    reload();
  }, [reload, path]);

  return { data, setData, loading, error, reload };
}
