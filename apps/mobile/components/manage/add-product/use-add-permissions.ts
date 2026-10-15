import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";

/** Which ways of adding a product the signed-in role may use */
export function useAddPermissions() {
  const role = useAuth().user?.role ?? "";
  return {
    canList: can(role, "store-products", "create"),
    canSnap: can(role, "catalog-drafts", "create"),
    canManual: can(role, "products", "create"),
    canQueue: can(role, "catalog-drafts", "list"),
  };
}
