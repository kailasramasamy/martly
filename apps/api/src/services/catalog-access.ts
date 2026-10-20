import type { FastifyInstance } from "fastify";

type Viewer = { role: string; organizationId?: string };

/** True when the viewer may see a record owned by `organizationId` (null = global/master) */
export function canSeeOrgRecord(viewer: Viewer, organizationId: string | null): boolean {
  if (viewer.role === "SUPER_ADMIN" || organizationId === null) return true;
  return organizationId === viewer.organizationId;
}

/** Rejects product ids that are neither launched master catalog nor owned by `organizationId` */
export async function assertProductsUsable(
  prisma: FastifyInstance["prisma"],
  productIds: string[],
  organizationId: string | null,
) {
  if (productIds.length === 0) return;
  const unique = [...new Set(productIds)];
  const usable = await prisma.product.count({
    where: { id: { in: unique }, OR: [{ organizationId: null, isDraft: false }, ...(organizationId ? [{ organizationId }] : [])] },
  });
  if (usable !== unique.length) {
    throw Object.assign(new Error("Some products aren't available to this organization"), { statusCode: 403 });
  }
}
