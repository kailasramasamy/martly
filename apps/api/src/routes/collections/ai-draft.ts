import type { FastifyInstance } from "fastify";
import { collectionDraftSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isCurationConfigured } from "../../services/seasonal/index.js";
import { orgSubcategoryCandidates, pickProducts } from "../../services/seasonal/candidates.js";
import { curate, CurationRefusedError, describeBrief } from "../../services/seasonal/curator.js";

const slugify = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** The AI curator's draft of a new collection from an admin's brief: copy in English and Tamil, products and banner art direction */
export async function collectionDraftRoutes(app: FastifyInstance) {
  app.post("/ai-draft", { preHandler: [authenticate, requirePermission(Permission.CATALOG_COLLECTIONS)] }, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI drafts need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const { brief, kind, organizationId } = collectionDraftSchema.parse(request.body);
    const user = getOrgUser(request);
    const orgId = user.role === "SUPER_ADMIN" ? organizationId : user.organizationId;
    if (!orgId) return reply.badRequest("Pick the organization whose stores the collection draws from");

    const curation = await curate(describeBrief(brief, kind), await orgSubcategoryCandidates(app.prisma, orgId)).catch((err: unknown) => {
      if (err instanceof CurationRefusedError) return null;
      throw err;
    });
    if (!curation) return reply.unprocessableEntity("The AI couldn't draft this brief; try rewording it");
    if (curation.skip) return reply.unprocessableEntity(curation.skipReason || "The stores don't stock enough for this brief");

    const ids = await pickProducts(app.prisma, orgId, curation.subcategoryIds);
    const rows = await app.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, imageUrl: true, subcategory: { select: { name: true } } },
    });
    const products = ids.flatMap((id) => rows.filter((r) => r.id === id))
      .map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, subcategory: p.subcategory?.name ?? null }));
    const draft = {
      title: curation.title, subtitle: curation.subtitle, titleTa: curation.titleTa, subtitleTa: curation.subtitleTa,
      slug: slugify(curation.title), artDirection: curation.imagePrompt, organizationId: orgId, products,
    };
    const response: ApiResponse<typeof draft> = { success: true, data: draft };
    return response;
  });
}
