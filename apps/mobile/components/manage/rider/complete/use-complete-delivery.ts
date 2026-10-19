import { useState } from "react";
import { refusedValue } from "@martly/shared/order-flow";
import type { RefuseReason } from "@martly/shared/constants";
import type { CollectedVia } from "../PaymentChoice";
import type { RefusedLine } from "../use-rider-actions";
import type { RiderStop } from "../types";
import type { RefusedState } from "./HandoverStep";

/** The rider's choices on the Complete delivery screen and everything derived from them */
export function useCompleteDelivery(stop: RiderStop | null) {
  const [via, setVia] = useState<CollectedVia>("CASH");
  const [checked, setChecked] = useState<string[]>([]);
  const [refused, setRefused] = useState<RefusedState>({});

  const changeLine = (id: string, next: { quantity?: number; reason?: RefuseReason }) =>
    setRefused((r) => ({ ...r, [id]: { ...(r[id] ?? { quantity: 0, reason: null }), ...next } }));
  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const taken = Object.entries(refused).filter(([, r]) => r.quantity > 0);
  const lines: RefusedLine[] = taken.filter(([, r]) => r.reason).map(([orderItemId, r]) => ({ orderItemId, quantity: r.quantity, reason: r.reason as RefuseReason }));
  const everything = !!stop && taken.length > 0 && stop.items.every((i) => (refused[i.id]?.quantity ?? 0) >= i.quantity);
  const missingReason = taken.some(([, r]) => !r.reason);
  const value = stop ? refusedValue(stop, taken.map(([orderItemId, r]) => ({ orderItemId, quantity: r.quantity }))) : 0;
  const cod = !!stop && stop.amountDue > 0;
  const due = cod ? Math.max(0, stop.amountDue - value) : 0;
  const blocker = everything
    ? "The customer isn't taking anything. Go back and use Couldn't deliver."
    : missingReason ? "Pick why the customer isn't taking each item." : null;

  return { via, setVia, checked, toggle, refused, changeLine, lines, value, cod, due, blocker, refusedCount: taken.length };
}
