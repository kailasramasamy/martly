import { can, canChangeStoreProductField } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";

export interface ListingAccess {
  stock: boolean;
  prices: boolean;
  listed: boolean;
  featured: boolean;
}

/** Which parts of a store listing the member may change; the API enforces the same per-field rules */
export function useListingAccess(): ListingAccess {
  const { user } = useAuth();
  const ok = (field: string) => !!user && can(user, "store-products", "edit") && canChangeStoreProductField(user, field);
  return { stock: ok("stock"), prices: ok("price"), listed: ok("isActive"), featured: ok("isFeatured") };
}
