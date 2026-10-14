import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import type { SearchEventType } from "@martly/shared/constants";
import { logSearch, logSearchEvent } from "./recent-searches";

/**
 * A search counts once the customer acts on it (submit, scroll, tab, leaving for a product) —
 * not on every debounced keystroke — so recents and trending only hold what people meant.
 */
export function useSearchCommit(storeId: string | undefined, query: string, resultCount: number, loading: boolean, onCommit: (query: string) => void) {
  const logged = useRef<{ query: string; id: Promise<string | null> } | null>(null);
  const commit = useCallback(() => {
    const q = query.trim();
    if (!storeId || q.length < 2 || loading || q.toLowerCase() === logged.current?.query) return;
    logged.current = { query: q.toLowerCase(), id: logSearch(storeId, q, resultCount) };
    if (resultCount > 0) onCommit(q);
  }, [storeId, query, resultCount, loading, onCommit]);

  // Acting on a result commits the search first, so the event belongs to the query on screen
  const track = useCallback((productId: string, type: SearchEventType, position: number) => {
    commit();
    const current = logged.current;
    if (!current || current.query !== query.trim().toLowerCase()) return;
    current.id.then((id) => { if (id) logSearchEvent(id, productId, type, position); });
  }, [commit, query]);

  // Blur covers tapping into a product or going back; the ref keeps the cleanup from firing per keystroke
  const latest = useRef(commit);
  latest.current = commit;
  useFocusEffect(useCallback(() => () => latest.current(), []));

  return { commit, track };
}
