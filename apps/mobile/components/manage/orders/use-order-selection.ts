import { useCallback, useState } from "react";
import type { OrderListItem } from "./types";

/** Multi-select state for the orders list; selecting anything enters selection mode */
export function useOrderSelection() {
  const [selected, setSelected] = useState<Map<string, OrderListItem>>(new Map());

  const toggle = useCallback((order: OrderListItem) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(order.id)) next.delete(order.id);
      else next.set(order.id, order);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Map()), []);

  return { selected, items: [...selected.values()], toggle, clear, active: selected.size > 0 };
}
