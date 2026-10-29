import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { creditStoreQuerySchema } from "@martly/shared/schemas";
import type { ApiResponse, CheckoutCredit, CreditOffer, CustomerCredits } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { claimCredits, customerCredits, guestOffers } from "../../services/credits/grants.js";
import { usableCredit } from "../../services/credits/spend.js";

const claimSchema = z.object({
  storeId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const meQuerySchema = z.object({ storeId: z.string().uuid().optional() });
const checkoutQuerySchema = creditStoreQuerySchema.extend({ orderAmount: z.coerce.number().min(0) });

/** Shopper side of the welcome credit: offers, claiming once a store delivers, the wallet view and checkout */
export async function creditCustomerRoutes(app: FastifyInstance) {
  // What signing up gets a guest: Martly's offer, and the store's when given
  app.get("/offers", { preHandler: [authenticateOptional] }, async (request) => {
    const { storeId } = meQuerySchema.parse(request.query);
    return { success: true, data: await guestOffers(app.prisma, storeId ?? null) } satisfies ApiResponse<CreditOffer[]>;
  });

  app.get("/me", { preHandler: [authenticate] }, async (request) => {
    const { storeId } = meQuerySchema.parse(request.query);
    const data = await customerCredits(app.prisma, getOrgUser(request).sub, storeId ?? null);
    return { success: true, data } satisfies ApiResponse<CustomerCredits>;
  });

  // The app claims when it has found a store that delivers to the customer
  app.post("/claim", { preHandler: [authenticate] }, async (request) => {
    const body = claimSchema.parse(request.body);
    const userId = getOrgUser(request).sub;
    await claimCredits(app.prisma, userId, body.storeId, { lat: body.lat, lng: body.lng });
    const data = await customerCredits(app.prisma, userId, body.storeId);
    return { success: true, data } satisfies ApiResponse<CustomerCredits>;
  });

  app.get("/checkout", { preHandler: [authenticate] }, async (request) => {
    const { storeId, orderAmount } = checkoutQuerySchema.parse(request.query);
    const data = await usableCredit(app.prisma, getOrgUser(request).sub, storeId, orderAmount);
    return { success: true, data } satisfies ApiResponse<CheckoutCredit>;
  });

  // The celebration was shown, so it isn't shown again
  app.post<{ Params: { id: string } }>("/grants/:id/seen", { preHandler: [authenticate] }, async (request, reply) => {
    const { count } = await app.prisma.creditGrant.updateMany({
      where: { id: request.params.id, userId: getOrgUser(request).sub, announcedAt: null },
      data: { announcedAt: new Date() },
    });
    if (count === 0 && !await app.prisma.creditGrant.findFirst({ where: { id: request.params.id, userId: getOrgUser(request).sub } })) {
      return reply.notFound("Credit not found");
    }
    return { success: true, data: { seen: true } } satisfies ApiResponse<{ seen: boolean }>;
  });
}
