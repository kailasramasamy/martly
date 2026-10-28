import { useState } from "react";
import type { PriceReviewGroup } from "@martly/shared/types";
import type { BulkKind } from "./BulkDialog";
import type { GroupBy } from "./OverviewHeader";
import type { useReviewActions } from "./use-review-actions";

/** A brand or aisle settled at once: the ⋯ sheet picks the action, the dialog confirms it */
export function useGroupBulk(by: GroupBy, actions: ReturnType<typeof useReviewActions>) {
  const [more, setMore] = useState<PriceReviewGroup | null>(null);
  const [bulk, setBulk] = useState<{ kind: BulkKind; group: PriceReviewGroup } | null>(null);
  const scopeOf = (g: PriceReviewGroup) => (by === "brand" ? { brandId: g.id } : { subcategoryId: g.id });

  const run = async (percent: number) => {
    if (!bulk) return;
    const { kind, group } = bulk;
    const body = kind === "percentOffMrp" ? { action: kind, percent, scope: scopeOf(group) } : { action: kind, scope: scopeOf(group) };
    await actions.bulk(body, (count) => `${group.name}: ${count} ${kind === "hide" ? "marked not sold" : "prices checked"}`);
    setBulk(null);
  };

  return { more, setMore, bulk, setBulk, scopeOf, run };
}
