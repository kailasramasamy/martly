import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  correctCountLineSchema, createStockCountSchema, requestRecountSchema, reviewStockCountSchema, saveStockCountLinesSchema,
  stockCountListQuerySchema,
} from "@martly/shared/schemas";
import { Permission } from "@martly/shared/constants";
import { hasPermission } from "@martly/shared/permissions";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgStoreIds, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { CountReviewError, approveCount, correctLine, requestRecount, submitCount } from "../../services/stock-count-review.js";
import { notifyCountReviewed, notifyCountSubmitted } from "../../services/notify/stock-alerts.js";
import { countDetail } from "./count-view.js";

const counters = [authenticate, requirePermission(Permission.STOCK_COUNT, Permission.STOCK_APPROVE)];
const approvers = [authenticate, requirePermission(Permission.STOCK_APPROVE)];

const canApprove = (request: FastifyRequest) =>
  request.user.role === "SUPER_ADMIN" || hasPermission(request.user.permissions, Permission.STOCK_APPROVE);

/** Blind shelf counts: counters record what's on the shelf, an approver applies the differences as COUNT movements */
export async function stockCountRoutes(app: FastifyInstance) {
  /** Loads a count the caller may work on, or replies with the reason they can't */
  async function ownCount(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const count = await app.prisma.stockCount.findUnique({ where: { id: request.params.id } });
    if (!count) return void reply.notFound("Stock count not found");
    if (!(await verifyStoreOrgAccess(request, app.prisma, count.storeId))) return void reply.forbidden("Access denied");
    return count;
  }

  async function respond(id: string, request: FastifyRequest) {
    const response: ApiResponse<Awaited<ReturnType<typeof countDetail>>> = {
      success: true,
      data: await countDetail(app.prisma, id, canApprove(request)),
    };
    return response;
  }

  /** Runs a review step, turning its rule violations into 400s */
  async function guarded(reply: FastifyReply, step: () => Promise<void>) {
    try {
      await step();
      return true;
    } catch (err) {
      if (!(err instanceof CountReviewError)) throw err;
      reply.badRequest(err.message);
      return false;
    }
  }

  app.get("/counts", { preHandler: counters }, async (request, reply) => {
    const query = stockCountListQuerySchema.parse(request.query);
    if (query.storeId && !(await verifyStoreOrgAccess(request, app.prisma, query.storeId))) return reply.forbidden("Access denied");
    const scope = await getOrgStoreIds(request, app.prisma);
    const where = {
      ...(query.storeId ? { storeId: query.storeId } : scope ? { storeId: { in: scope } } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      app.prisma.stockCount.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          store: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
      }),
      app.prisma.stockCount.count({ where }),
    ]);
    const response: PaginatedResponse<(typeof rows)[0]> = {
      success: true,
      data: rows,
      meta: { total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) },
    };
    return response;
  });

  app.post("/counts", { preHandler: counters }, async (request, reply) => {
    const body = createStockCountSchema.parse(request.body);
    const store = await app.prisma.store.findUnique({ where: { id: body.storeId }, select: { organizationId: true } });
    if (!store || !(await verifyStoreOrgAccess(request, app.prisma, body.storeId))) return reply.forbidden("Access denied");
    const count = await app.prisma.stockCount.create({
      data: { ...body, organizationId: store.organizationId, createdById: request.user.sub },
    });
    return respond(count.id, request);
  });

  app.get<{ Params: { id: string } }>("/counts/:id", { preHandler: counters }, async (request, reply) => {
    const count = await ownCount(request, reply);
    if (!count) return;
    return respond(count.id, request);
  });

  app.put<{ Params: { id: string } }>("/counts/:id/lines", { preHandler: counters }, async (request, reply) => {
    const { lines } = saveStockCountLinesSchema.parse(request.body);
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "DRAFT" && count.status !== "RECOUNT") return reply.conflict("This count has already been submitted");
    const ids = lines.map((l) => l.storeProductId);
    const valid = await app.prisma.storeProduct.count({
      where: { id: { in: ids }, storeId: count.storeId, product: { subcategoryId: count.subcategoryId } },
    });
    if (valid !== new Set(ids).size) return reply.badRequest("Every product must be in this count's store and aisle");

    if (count.status === "RECOUNT") {
      // A recount only touches the flagged lines, and keeps its numbers apart from the first count's
      const flagged = await app.prisma.stockCountLine.count({ where: { stockCountId: count.id, recountRequested: true, storeProductId: { in: ids } } });
      if (flagged !== new Set(ids).size) return reply.badRequest("Only the products sent for recount can be counted again");
      await app.prisma.$transaction(lines.map((l) => app.prisma.stockCountLine.update({
        where: { stockCountId_storeProductId: { stockCountId: count.id, storeProductId: l.storeProductId } },
        data: { recountQty: l.countedQty },
      })));
      return respond(count.id, request);
    }
    await app.prisma.$transaction(lines.map((l) => app.prisma.stockCountLine.upsert({
      where: { stockCountId_storeProductId: { stockCountId: count.id, storeProductId: l.storeProductId } },
      create: { stockCountId: count.id, ...l },
      update: { countedQty: l.countedQty },
    })));
    return respond(count.id, request);
  });

  app.post<{ Params: { id: string } }>("/counts/:id/submit", { preHandler: counters }, async (request, reply) => {
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "DRAFT" && count.status !== "RECOUNT") return reply.conflict("This count has already been submitted");
    const recount = count.status === "RECOUNT";
    if (!(await guarded(reply, () => submitCount(app.prisma, count.id, recount, request.user.sub)))) return;
    // A counter who may approve doesn't need a second person
    if (canApprove(request)) await approveCount(app.prisma, count.id, request.user.sub, undefined);
    else void notifyCountSubmitted(app.fcm, app.prisma, count.id, request.user.sub);
    return respond(count.id, request);
  });

  app.post<{ Params: { id: string } }>("/counts/:id/approve", { preHandler: approvers }, async (request, reply) => {
    const { note } = reviewStockCountSchema.parse(request.body ?? {});
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "SUBMITTED") return reply.conflict("Only submitted counts can be approved");
    await approveCount(app.prisma, count.id, request.user.sub, note);
    void notifyCountReviewed(app.fcm, app.prisma, count.id, "approved", request.user.sub);
    return respond(count.id, request);
  });

  app.post<{ Params: { id: string } }>("/counts/:id/reject", { preHandler: approvers }, async (request, reply) => {
    const { note } = reviewStockCountSchema.parse(request.body ?? {});
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "SUBMITTED") return reply.conflict("Only submitted counts can be rejected");
    await app.prisma.stockCount.update({
      where: { id: count.id },
      data: { status: "REJECTED", reviewedById: request.user.sub, reviewedAt: new Date(), reviewNote: note },
    });
    void notifyCountReviewed(app.fcm, app.prisma, count.id, "rejected", request.user.sub);
    return respond(count.id, request);
  });

  // Send chosen lines back to the counter; the rest can be applied to stock straight away
  app.post<{ Params: { id: string } }>("/counts/:id/recount", { preHandler: approvers }, async (request, reply) => {
    const body = requestRecountSchema.parse(request.body);
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "SUBMITTED") return reply.conflict("Only submitted counts can be sent for recount");
    if (!(await guarded(reply, () => requestRecount(app.prisma, count.id, body, request.user.sub)))) return;
    void notifyCountReviewed(app.fcm, app.prisma, count.id, "recount", request.user.sub);
    return respond(count.id, request);
  });

  app.put<{ Params: { id: string; storeProductId: string } }>("/counts/:id/lines/:storeProductId/correct", { preHandler: approvers }, async (request, reply) => {
    const { countedQty, reason } = correctCountLineSchema.parse(request.body);
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "SUBMITTED") return reply.conflict("Only submitted counts can be corrected");
    if (!(await guarded(reply, () => correctLine(app.prisma, count.id, request.params.storeProductId, countedQty, reason, request.user.sub)))) return;
    return respond(count.id, request);
  });

  app.delete<{ Params: { id: string } }>("/counts/:id", { preHandler: counters }, async (request, reply) => {
    const count = await ownCount(request, reply);
    if (!count) return;
    if (count.status !== "DRAFT") return reply.conflict("Only unsubmitted counts can be discarded");
    await app.prisma.stockCount.delete({ where: { id: count.id } });
    const response: ApiResponse<null> = { success: true, data: null };
    return response;
  });
}
