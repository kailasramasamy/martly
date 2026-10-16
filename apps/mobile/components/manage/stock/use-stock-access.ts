import { Permission } from "@martly/shared/constants";
import { hasPermission } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";

/** What the signed-in member may do with stock; SUPER_ADMIN passes every check */
export function useStockAccess() {
  const { user } = useAuth();
  const has = (p: Permission) => user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, p);
  return {
    canCount: has(Permission.STOCK_COUNT),
    canApprove: has(Permission.STOCK_APPROVE),
    canReceive: has(Permission.STOCK_RECEIVE),
    canAdjust: has(Permission.STOCK_ADJUST),
    canView: has(Permission.STOCK_VIEW),
  };
}
