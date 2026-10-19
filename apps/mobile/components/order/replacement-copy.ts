const REASON_NOUN: Record<string, string> = {
  "Damaged/broken item": "damaged item",
  "Wrong item received": "wrong item",
  "Item expired/stale": "expired item",
};

/** Explains a ₹0 replacement line: what it replaces and that it was already paid for */
export function replacementNote(reason: string | null | undefined, orderId: string): string {
  const what = (reason && REASON_NOUN[reason]) ?? "item you returned";
  return `Replaces the ${what} from order #${orderId.slice(0, 8).toUpperCase()}. You already paid for it.`;
}
