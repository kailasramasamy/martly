import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Store } from "../../lib/types";

export interface MemberStatus {
  isMember: boolean;
  membership: { planName: string; endDate: string; daysLeft: number } | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;

/** The shopper's Plus membership and whether they have subscriptions at this store; guests have neither */
export function useMemberStatus(store: Store | null, isAuthenticated: boolean) {
  const [memberStatus, setMemberStatus] = useState<MemberStatus | null>(null);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);

  const refresh = useCallback(() => {
    if (!store || !isAuthenticated) {
      setMemberStatus(null);
      setHasSubscriptions(false);
      return;
    }
    api
      .get<{ isMember: boolean; membership: { planName: string; endDate: string } | null }>(`/api/v1/memberships/status?storeId=${store.id}`)
      .then((res) => {
        const m = res.data.membership;
        const daysLeft = m ? Math.max(0, Math.ceil((new Date(m.endDate).getTime() - Date.now()) / DAY_MS)) : 0;
        setMemberStatus({ isMember: res.data.isMember, membership: m ? { ...m, daysLeft } : null });
      })
      .catch(() => setMemberStatus(null));
    if (!store.subscriptionEnabled) {
      setHasSubscriptions(false);
      return;
    }
    api
      .getList<{ id: string }>(`/api/v1/subscriptions?storeId=${store.id}`)
      .then((res) => setHasSubscriptions(res.data.length > 0))
      .catch(() => setHasSubscriptions(false));
  }, [store, isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { memberStatus, hasSubscriptions, refresh };
}
