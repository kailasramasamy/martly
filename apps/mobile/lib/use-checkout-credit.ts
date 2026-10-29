import { useEffect, useState } from "react";
import type { CheckoutCredit } from "@martly/shared/types";
import { api } from "./api";
import { useCredits } from "./credits-context";
import { useCreditCopy } from "./credit-copy";
import { useStrings } from "./i18n/use-strings";

/**
 * The welcome credit this checkout would take off, re-read whenever the amount it is measured against changes.
 * It always applies when it qualifies: credit is for the first order only, so there is no later order to keep it for.
 */
export function useCheckoutCredit(storeId: string | null, orderAmount: number) {
  const { isCustomer, storeGrants: grants } = useCredits();
  const copy = useCreditCopy();
  const t = useStrings("credits").checkout;
  const [credit, setCredit] = useState<CheckoutCredit>({ amount: 0, grantIds: [] });
  const hasGrants = grants.length > 0;

  useEffect(() => {
    if (!isCustomer || !storeId || !hasGrants) {
      setCredit({ amount: 0, grantIds: [] });
      return;
    }
    let live = true;
    api.get<CheckoutCredit>(`/api/v1/credits/checkout?storeId=${storeId}&orderAmount=${orderAmount}`).then(
      (res) => live && setCredit({ amount: Number(res.data.amount), grantIds: res.data.grantIds }),
      () => live && setCredit({ amount: 0, grantIds: [] }),
    );
    return () => { live = false; };
  }, [isCustomer, storeId, hasGrants, orderAmount]);

  const used = grants.filter((g) => credit.grantIds.includes(g.id));
  // One credit goes by its own name; Martly's and the store's together are just "Free credit"
  const name = used.length === 1 ? copy.name(used[0]) : t.together;
  // Whatever this order doesn't use is gone once it's placed
  const lost = grants.filter((g) => !credit.grantIds.includes(g.id));
  return { applied: credit.amount, name, lost };
}

export type CheckoutCreditState = ReturnType<typeof useCheckoutCredit>;
