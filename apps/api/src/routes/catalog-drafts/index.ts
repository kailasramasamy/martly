import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { approveCatalogDraftSchema, catalogDraftListQuerySchema, createCatalogDraftSchema } from "@martly/shared/schemas";
import type { ApiResponse, CatalogDraftDetail, CatalogDraftSummary, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import { getOrgStoreIds, getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { isMediaUrl } from "../../services/media.js";
import type { ProcessedShot } from "../../services/catalog-agent/images.js";
import { DraftStateError, publishNew, type Proposal } from "../../services/catalog-agent/publish.js";
import { assertBrandUsable } from "../../services/brands.js";
import { draftInclude, toDetail, toSummary } from "../../services/catalog-agent/view.js";

const MANAGERS = [authenticate, requirePermission(Permission.CATALOG_PRODUCTS)];

type IdRequest = FastifyRequest<{ Params: { id: string } }>;

export async function catalogDraftRoutes(app: FastifyInstance) {
  // The draft, if the caller may see its store; sends the error reply and returns undefined otherwise
  async function ownDraft(request: IdRequest, reply: FastifyReply) {
    const draft = await app.prisma.catalogDraft.findUnique({ where: { id: request.params.id }, include: draftInclude });
    if (!draft) return void reply.notFound("Draft not found");
    if (!(await verifyStoreOrgAccess(request, app.prisma, draft.storeId))) return void reply.forbidden("Access denied");
    return draft;
  }

  async function detail(id: string) {
    const row = await app.prisma.catalogDraft.findUniqueOrThrow({ where: { id }, include: draftInclude });
    return { success: true, data: toDetail(row) } satisfies ApiResponse<CatalogDraftDetail>;
  }

  app.post("/", { preHandler: MANAGERS }, async (request, reply) => {
    const body = createCatalogDraftSchema.parse(request.body);
    if (!body.photos.every(isMediaUrl)) return reply.badRequest("Upload the photos through /uploads first");
    if (!(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) return reply.forbidden("Access denied");
    const store = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const draft = await app.prisma.catalogDraft.create({
      data: { ...body, hintName: body.hintName || null, organizationId: store.organizationId, createdById: getOrgUser(request).sub },
      include: draftInclude,
    });
    return reply.code(201).send({ success: true, data: toSummary(draft) } satisfies ApiResponse<CatalogDraftSummary>);
  });

  app.get("/", { preHandler: MANAGERS }, async (request, reply) => {
    const { page, pageSize, storeId, status } = catalogDraftListQuerySchema.parse(request.query);
    const storeIds = await getOrgStoreIds(request, app.prisma);
    if (storeId && storeIds && !storeIds.includes(storeId)) return reply.forbidden("Access denied");
    const where = {
      ...(storeId ? { storeId } : storeIds ? { storeId: { in: storeIds } } : {}),
      ...(status ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      app.prisma.catalogDraft.findMany({ where, include: draftInclude, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.catalogDraft.count({ where }),
    ]);
    return {
      success: true, data: rows.map(toSummary), meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    } satisfies PaginatedResponse<CatalogDraftSummary>;
  });

  app.get<{ Params: { id: string } }>("/:id", { preHandler: MANAGERS }, async (request, reply) => {
    const draft = await ownDraft(request, reply);
    if (!draft) return;
    return { success: true, data: toDetail(draft) } satisfies ApiResponse<CatalogDraftDetail>;
  });

  app.post<{ Params: { id: string } }>("/:id/approve", { preHandler: MANAGERS }, async (request, reply) => {
    const edits = approveCatalogDraftSchema.parse(request.body ?? {});
    const draft = await ownDraft(request, reply);
    if (!draft) return;
    if (draft.status !== "NEEDS_REVIEW" || !draft.extracted) return reply.conflict("Only drafts waiting for review can be approved");
    const proposal = draft.extracted as unknown as Proposal;
    const mrp = edits.mrp ?? Number(draft.mrp);
    if ((edits.sellingPrice ?? Number(draft.sellingPrice)) > mrp) return reply.badRequest("Selling price can't be above MRP");
    if (!(edits.subcategoryId ?? proposal.classification.subcategoryId)) return reply.badRequest("Choose an aisle for this product");
    if (edits.subcategoryId && !(await app.prisma.subcategory.findUnique({ where: { id: edits.subcategoryId } }))) return reply.badRequest("Unknown aisle");
    await assertBrandUsable(app.prisma, edits.brandId, draft.organizationId);
    try {
      await publishNew(app.prisma, draft, proposal, draft.processedImages as unknown as ProcessedShot[], edits);
    } catch (err) {
      if (err instanceof DraftStateError) return reply.conflict(err.message);
      throw err;
    }
    return detail(draft.id);
  });

  app.post<{ Params: { id: string } }>("/:id/retry", { preHandler: MANAGERS }, async (request, reply) => {
    const draft = await ownDraft(request, reply);
    if (!draft) return;
    const { count } = await app.prisma.catalogDraft.updateMany({
      where: { id: draft.id, status: "FAILED" },
      data: { status: "QUEUED", attempts: 0, error: null, claimedAt: null },
    });
    if (!count) return reply.conflict("Only failed drafts can be retried");
    return detail(draft.id);
  });

  app.post<{ Params: { id: string } }>("/:id/discard", { preHandler: MANAGERS }, async (request, reply) => {
    const draft = await ownDraft(request, reply);
    if (!draft) return;
    const { count } = await app.prisma.catalogDraft.updateMany({
      where: { id: draft.id, status: { in: ["QUEUED", "NEEDS_REVIEW", "FAILED"] } },
      data: { status: "DISCARDED" },
    });
    if (!count) return reply.conflict("This draft can no longer be discarded");
    return detail(draft.id);
  });
}
