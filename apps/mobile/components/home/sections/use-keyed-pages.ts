import { useCallback, useRef, useState } from "react";

/**
 * Pages fetched on demand by key (a tab, a price band), each fetched once and kept. While a page loads, `page` keeps
 * the last one shown, so the block holds its height instead of collapsing; a failed fetch goes back to that page.
 */
export function useKeyedPages<T>(initialKey: string, initial: T, fetchPage: (key: string) => Promise<T>) {
  const [cache, setCache] = useState<Record<string, T>>({ [initialKey]: initial });
  const [key, setKey] = useState(initialKey);
  const shown = useRef({ key: initialKey, page: initial });
  const requested = useRef(new Set([initialKey]));

  const loaded = cache[key];
  if (loaded) shown.current = { key, page: loaded };

  const select = useCallback((next: string) => {
    setKey(next);
    if (requested.current.has(next)) return;
    requested.current.add(next);
    fetchPage(next)
      .then((page) => setCache((prev) => ({ ...prev, [next]: page })))
      .catch(() => {
        requested.current.delete(next);
        setKey((current) => (current === next ? shown.current.key : current));
      });
  }, [fetchPage]);

  return { key, page: shown.current.page, loading: !loaded, select };
}
