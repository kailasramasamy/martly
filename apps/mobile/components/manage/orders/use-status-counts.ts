import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { toQuery } from "../../../lib/manage/query";
import { useOrdersTick } from "../../../lib/manage/use-live-orders";

export type StatusCounts = Record<string, number>;

/** Order totals per status for a store scope (null = all stores); refetches on live order changes */
export function useStatusCounts(statuses: readonly string[], storeId: string | null) {
  const [counts, setCounts] = useState<StatusCounts>({});
  const tick = useOrdersTick();
  const statusKey = statuses.join(",");

  const load = useCallback(async () => {
    const results = await Promise.all(
      statusKey.split(",").map((status) =>
        api.getList(`/api/v1/orders${toQuery({ status, pageSize: 1, storeId })}`).then((res) => [status, res.meta.total] as const),
      ),
    );
    setCounts(Object.fromEntries(results));
  }, [statusKey, storeId]);

  const reload = useCallback(() => load().catch(() => undefined), [load]);

  useEffect(() => {
    reload();
  }, [reload, tick]);

  return { counts, reload };
}
