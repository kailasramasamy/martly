import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { useRefreshOnFocus } from "./use-refresh-on-focus";

/** Fetch a single `ApiResponse<T>` resource; pass `null` to skip (e.g. "create" mode). Refetches when the screen regains focus. */
export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  // What the server last sent, to tell whether a refocus refetch brought anything new
  const lastJson = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    setError(null);
    try {
      const res = await api.get<T>(path);
      const json = JSON.stringify(res.data);
      // Unchanged data keeps its identity, so forms built from it don't lose unsaved edits on refocus
      if (json !== lastJson.current) {
        lastJson.current = json;
        setData(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    lastJson.current = null;
    setLoading(!!path);
    reload();
  }, [reload, path]);

  useRefreshOnFocus(reload);

  return { data, setData, loading, error, reload };
}
