import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";

/** Which ways of adding a product the signed-in role may use */
export function useAddPermissions() {
  const { user } = useAuth();
  return {
    canList: can(user, "store-products", "create"),
    canSnap: can(user, "catalog-drafts", "create"),
    /** The full product form is for Martly staff; owners add their own products from photos */
    canManual: user?.role === "SUPER_ADMIN" && can(user, "products", "create"),
    canQueue: can(user, "catalog-drafts", "list"),
    /** Raw captures processed on Martly's Mac, so only Martly staff batch them */
    canBatch: user?.role === "SUPER_ADMIN" && can(user, "catalog-drafts", "create"),
  };
}
