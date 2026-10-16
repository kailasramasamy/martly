import { can } from "@martly/shared/permissions";
import type { UserInfo } from "../../../lib/auth-context";

/** Two-tier catalog: master products belong to SUPER_ADMIN, org products to that org's ORG_ADMIN */
export function canEditProduct(user: UserInfo | null, product: { organizationId: string | null }): boolean {
  if (!user || !can(user, "products", "edit")) return false;
  if (user.role === "SUPER_ADMIN") return product.organizationId === null;
  return product.organizationId !== null && product.organizationId === user.organizationId;
}
