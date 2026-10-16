import { useState } from "react";

/** Selection mode for choosing which counted lines go back for a recount; null selection = not selecting */
export function useRecountSelection() {
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const start = () => setSelected(new Set());
  const cancel = () => setSelected(null);
  const toggle = (storeProductId: string) =>
    setSelected((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (!next.delete(storeProductId)) next.add(storeProductId);
      return next;
    });

  return { selected, start, cancel, toggle };
}
