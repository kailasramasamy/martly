import type { FastifyInstance } from "fastify";
import { toggleWishlistSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";

export async function wishlistRoutes(app: FastifyInstance) {
  // GET / - List user's wishlist items
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const user = request.user as { sub: string };
    const items = await app.prisma.wishlistItem.findMany({
      where: { userId: user.sub },
      include: {
        product: {
          include: { brand: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const response: ApiResponse<typeof items> = { success: true, data: items };
    return response;
  });

  // POST /toggle - Add/remove product from wishlist
  app.post("/toggle", { preHandler: [authenticate] }, async (request) => {
    const body = toggleWishlistSchema.parse(request.body);
    const user = request.user as { sub: string };

    const existing = await app.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId: user.sub, productId: body.productId } },
    });

    if (existing) {
      await app.prisma.wishlistItem.delete({ where: { id: existing.id } });
      const response: ApiResponse<{ wishlisted: boolean }> = { success: true, data: { wishlisted: false } };
      return response;
    }

    await app.prisma.wishlistItem.create({
      data: { userId: user.sub, productId: body.productId },
    });
    const response: ApiResponse<{ wishlisted: boolean }> = { success: true, data: { wishlisted: true } };
    return response;
  });

  // GET /check?productIds=a,b,c - Batch check wishlisted status
  app.get("/check", { preHandler: [authenticate] }, async (request) => {
    const { productIds } = request.query as { productIds?: string };
    const user = request.user as { sub: string };

    if (!productIds) {
      const response: ApiResponse<Record<string, boolean>> = { success: true, data: {} };
      return response;
    }

    const ids = productIds.split(",").filter(Boolean);
    const items = await app.prisma.wishlistItem.findMany({
      where: { userId: user.sub, productId: { in: ids } },
      select: { productId: true },
    });

    const map: Record<string, boolean> = {};
    for (const id of ids) map[id] = false;
    for (const item of items) map[item.productId] = true;

    const response: ApiResponse<Record<string, boolean>> = { success: true, data: map };
    return response;
  });
}
