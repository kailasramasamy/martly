import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { useManageScope } from "../../../lib/manage-scope-context";
import type { Entitlements } from "./plan-types";

/** What the organization's marketing plan allows right now (promotions, AI images, push) */
export function useEntitlements() {
  const { organizationId } = useManageScope();
  const resource = useResource<Entitlements>(`/api/v1/marketing/entitlements${toQuery({ organizationId })}`);
  return { ...resource, organizationId };
}

export const promotionsLeft = (e: Entitlements) => e.promotions.planLeft + e.promotions.topUpBalance;
