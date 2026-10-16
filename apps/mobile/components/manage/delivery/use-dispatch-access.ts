import { Permission } from "@martly/shared/constants";
import { hasPermission } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";

/**
 * Dispatchers (managers, owners, staff with Dispatch orders) run the whole board; riders who can only deliver
 * see their own trips.
 */
export function useDispatchAccess() {
  const { user } = useAuth();
  const canDispatch = user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, Permission.ORDERS_DISPATCH);
  const riderOnly = !canDispatch && hasPermission(user?.permissions, Permission.DELIVERY_DELIVER);
  const canManageRiders = user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, Permission.RIDERS_MANAGE);
  return { canDispatch, riderOnly, canManageRiders, userId: user?.id ?? null };
}
