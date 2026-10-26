import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { requireOrgContext, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { draftBranding, draftOfferPicks, draftPost } from "../../services/storefront/ai.js";

const bodySchema = z.object({ storeId: z.string().uuid() });

/** Drafts for the owner to review; nothing here saves anything */
export async function storefrontAiRoutes(app: FastifyInstance) {
  const opts = { preHandler: [authenticate, requireOrgContext, requirePermission(Permission.MARKETING_MANAGE)] };
  const DRAFTS = { branding: draftBranding, post: draftPost, "offer-picks": draftOfferPicks } as const;

  for (const [path, draft] of Object.entries(DRAFTS)) {
    app.post(`/${path}`, opts, async (request, reply) => {
      const { storeId } = bodySchema.parse(request.body);
      if (!(await verifyStoreOrgAccess(request, app.prisma, storeId))) return reply.forbidden("Access denied to this store");
      return { success: true, data: await draft(app.prisma, storeId) };
    });
  }
}
