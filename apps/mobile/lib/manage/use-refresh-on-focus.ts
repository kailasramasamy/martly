import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/** Re-run `refresh` whenever the screen regains focus, skipping the first focus (the initial load covers it) */
export function useRefreshOnFocus(refresh: () => void) {
  const first = useRef(true);
  const latest = useRef(refresh);
  latest.current = refresh;
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      latest.current();
    }, []),
  );
}
