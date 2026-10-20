import { strings } from "../../lib/i18n";

/** Explains a ₹0 replacement line: what it replaces and that it was already paid for */
export function replacementNote(reason: string | null | undefined, orderId: string): string {
  const t = strings("orders").item;
  const nouns: Record<string, string> = {
    "Damaged/broken item": t.replacesDamaged,
    "Wrong item received": t.replacesWrong,
    "Item expired/stale": t.replacesExpired,
  };
  return t.replacesNote((reason && nouns[reason]) ?? t.replacesDefault, orderId.slice(0, 8).toUpperCase());
}
