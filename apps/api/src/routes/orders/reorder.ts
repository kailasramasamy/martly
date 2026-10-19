import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "../../services/store-product-view.js";

interface ReorderItems {
  store: { id: string; name: string };
  items: { storeProduct: StoreProductView; quantity: number }[];
  /** Lines from the order the store no longer sells or has run out of */
  unavailable: { productName: string; variantName: string }[];
}

/** A customer's past order as it can be bought today: current price and stock at the same store, quantities capped to what's left */
export async function reorderRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/:id/reorder-items", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const order = await app.prisma.order.findFirst({
      where: { id: request.params.id, userId: user.sub },
      select: {
        store: { select: { id: true, name: true } },
        items: { select: { variantId: true, quantity: true, product: { select: { name: true } }, variant: { select: { name: true } } } },
      },
    });
    if (!order) return reply.notFound("Order not found");

    const rows = await app.prisma.storeProduct.findMany({
      where: {
        storeId: order.store.id,
        variantId: { in: order.items.map((i) => i.variantId) },
        isActive: true,
        product: { isActive: true },
      },
      include: storeProductInclude,
    });
    const byVariant = new Map((await decorateStoreProducts(app.prisma, rows)).map((sp) => [sp.variantId, sp]));

    const data: ReorderItems = { store: order.store, items: [], unavailable: [] };
    for (const line of order.items) {
      const sp = byVariant.get(line.variantId);
      if (sp && sp.availableStock > 0) data.items.push({ storeProduct: sp, quantity: Math.min(line.quantity, sp.availableStock) });
      else data.unavailable.push({ productName: line.product.name, variantName: line.variant.name });
    }
    const response: ApiResponse<ReorderItems> = { success: true, data };
    return response;
  });
}
