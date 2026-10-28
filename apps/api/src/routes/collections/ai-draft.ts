import type { FastifyInstance } from "fastify";
import { collectionDraftSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { Permission } from "@martly/shared/constants";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { isCurationConfigured } from "../../services/seasonal/index.js";
import { draftCollection } from "../../services/collection-ai-draft.js";

/** The AI curator's draft of a new collection from an admin's brief: copy in English and Tamil, products and banner art direction */
export async function collectionDraftRoutes(app: FastifyInstance) {
  app.post("/ai-draft", { preHandler: [authenticate, requirePermission(Permission.CATALOG_COLLECTIONS)] }, async (request, reply) => {
    if (!isCurationConfigured()) return reply.serviceUnavailable("AI drafts need ANTHROPIC_API_KEY and OPENAI_API_KEY");
    const { brief, kind, organizationId } = collectionDraftSchema.parse(request.body);
    const user = getOrgUser(request);
    const orgId = user.role === "SUPER_ADMIN" ? organizationId : user.organizationId;
    if (!orgId) return reply.badRequest("Pick the organization whose stores the collection draws from");

    const draft = await draftCollection(app.prisma, orgId, brief, kind);
    if (typeof draft === "string") return reply.unprocessableEntity(draft);
    const response: ApiResponse<typeof draft> = { success: true, data: draft };
    return response;
  });
}
