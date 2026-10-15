import { useState } from "react";
import { useToast } from "../../../lib/toast-context";

const MAX_TRIP_ORDERS = 30;

/** Multi-select of order ids, capped at what a single trip can hold */
export function useSelection() {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    if (!selected.has(id) && selected.size >= MAX_TRIP_ORDERS) {
      toast.show(`A trip holds up to ${MAX_TRIP_ORDERS} orders`, "error");
      return;
    }
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setSelected(next);
  };

  return { selected, toggle, clear: () => setSelected(new Set()) };
}
