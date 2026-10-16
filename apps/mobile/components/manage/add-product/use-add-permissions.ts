import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";

/** Which ways of adding a product the signed-in role may use */
export function useAddPermissions() {
  const { user } = useAuth();
  return {
    canList: can(user, "store-products", "create"),
    canSnap: can(user, "catalog-drafts", "create"),
    canManual: can(user, "products", "create"),
    canQueue: can(user, "catalog-drafts", "list"),
  };
}
