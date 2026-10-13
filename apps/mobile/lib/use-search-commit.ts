import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { logSearch } from "./recent-searches";

/**
 * A search counts once the customer acts on it (submit, scroll, tab, leaving for a product) —
 * not on every debounced keystroke — so recents and trending only hold what people meant.
 */
export function useSearchCommit(storeId: string | undefined, query: string, resultCount: number, loading: boolean, onCommit: (query: string) => void) {
  const lastCommitted = useRef("");
  const commit = useCallback(() => {
    const q = query.trim();
    if (!storeId || q.length < 2 || loading || q.toLowerCase() === lastCommitted.current) return;
    lastCommitted.current = q.toLowerCase();
    logSearch(storeId, q, resultCount);
    if (resultCount > 0) onCommit(q);
  }, [storeId, query, resultCount, loading, onCommit]);

  // Blur covers tapping into a product or going back; the ref keeps the cleanup from firing per keystroke
  const latest = useRef(commit);
  latest.current = commit;
  useFocusEffect(useCallback(() => () => latest.current(), []));

  return commit;
}
