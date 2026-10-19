import { useEffect, useState } from "react";
import { RETURN_KEEP_REASONS, type ReturnMethod, type ReturnRemedy } from "@martly/shared/constants";
import { formatINR } from "../ui/tokens";
import type { ReturnRequestDetail } from "./types";

const WRONG_ITEM = "wrong item received";

/** Why "Customer keeps it" is preselected, or null when it isn't */
function keepHint(request: ReturnRequestDetail): string | null {
  const limit = request.store.returnKeepThreshold;
  if (limit != null && Number(request.requestedAmount) <= Number(limit)) return `Within this store's keep-it limit of ${formatINR(Number(limit))}.`;
  return RETURN_KEEP_REASONS.includes(request.reason) ? "Not worth collecting for this reason." : null;
}

export function useResolveForm(request: ReturnRequestDetail) {
  const hint = keepHint(request);
  const [amount, setAmount] = useState(request.requestedAmount);
  const [remedy, setRemedy] = useState<ReturnRemedy>("REFUND");
  const [method, setMethod] = useState<ReturnMethod>(hint ? "KEEP" : "NEXT_ORDER");
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const wrong = request.reason.toLowerCase() === WRONG_ITEM;
    setRestock(Object.fromEntries(request.items.map((i) => [i.id, wrong])));
  }, [request]);
  return { hint, amount, setAmount, remedy, setRemedy, method, setMethod, restock, setRestock };
}
