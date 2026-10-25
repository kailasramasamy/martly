import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createMonthlyListSchema, monthlyListItemsSchema, monthlyListQuoteSchema, updateMonthlyListSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { createMonthlyList, monthlyListView, replaceMonthlyListItems, updateMonthlyList } from "../../services/monthly-list/index.js";
import { itemOptions } from "../../services/monthly-list/options.js";
import { quickOrderQuote } from "../../services/monthly-list/quick-order.js";

const idParams = z.object({ id: z.string().uuid() });
const itemParams = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
const storeQuery = z.object({ storeId: z.string().uuid() });

/** The shopper's own monthly lists; every route is scoped to the signed-in user */
export async function monthlyListRoutes(app: FastifyInstance) {
  const activeStore = (id: string) => app.prisma.store.findFirst({ where: { id, status: "ACTIVE" }, select: { id: true } });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createMonthlyListSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    if (!(await activeStore(body.data.storeId))) return reply.notFound("Store not found");
    const userId = getOrgUser(request).sub;
    const list = await createMonthlyList(app.prisma, userId, body.data);
    if (!list) return reply.notFound("No recent order at this store to start from");
    const data = await monthlyListView(app.prisma, userId, { id: list.id });
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const query = storeQuery.safeParse(request.query);
    if (!query.success) return reply.badRequest("storeId is required");
    const data = await monthlyListView(app.prisma, getOrgUser(request).sub, { storeId: query.data.storeId });
    if (!data) return reply.notFound("No monthly list at this store");
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.put("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = updateMonthlyListSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.badRequest("Invalid monthly list update");
    const userId = getOrgUser(request).sub;
    if (!(await updateMonthlyList(app.prisma, userId, params.data.id, body.data))) return reply.notFound("Monthly list not found");
    const data = await monthlyListView(app.prisma, userId, { id: params.data.id });
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.put("/:id/items", { preHandler: [authenticate] }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = monthlyListItemsSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.badRequest("Invalid monthly list items");
    const userId = getOrgUser(request).sub;
    if (!(await replaceMonthlyListItems(app.prisma, userId, params.data.id, body.data))) return reply.notFound("Monthly list not found");
    const data = await monthlyListView(app.prisma, userId, { id: params.data.id });
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // Other sizes and brands a line can be swapped for, in stock today
  app.get("/:id/items/:itemId/options", { preHandler: [authenticate] }, async (request, reply) => {
    const params = itemParams.safeParse(request.params);
    if (!params.success) return reply.badRequest("Invalid list item");
    const data = await itemOptions(app.prisma, getOrgUser(request).sub, params.data.id, params.data.itemId);
    if (!data) return reply.notFound("List item not found");
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // What "Order as is" would place for this month's lines: address, delivery and the amount, or why it has to go through checkout
  app.post("/:id/quick-order", { preHandler: [authenticate] }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = monthlyListQuoteSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.badRequest("Invalid quick order");
    const data = await quickOrderQuote(app.prisma, getOrgUser(request).sub, params.data.id, body.data);
    if (!data) return reply.notFound("Monthly list not found");
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });
}
