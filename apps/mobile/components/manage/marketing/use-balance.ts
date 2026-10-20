import { useResource } from "../../../lib/manage/use-resource";
import type { LedgerSummary } from "../../../lib/ledger-types";
import type { AdProduct } from "./plan-types";

/** The owner's ledger balance, which can pay for one-off marketing purchases instead of a card */
export function useBalance(enabled: boolean) {
  const { data, reload } = useResource<LedgerSummary>(enabled ? "/api/v1/ledger/summary" : null);
  const funds = data?.owner ? data.available + data.owner.carried : 0;
  // The server prices and checks the order; this only decides whether to offer the option
  const covers = (product: AdProduct, quantity: number) => funds >= product.price * quantity * (1 + product.gstPercent / 100);
  return { funds, covers, reload };
}
