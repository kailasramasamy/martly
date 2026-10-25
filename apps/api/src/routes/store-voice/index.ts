import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { MAX_PICKS_PER_AISLE, Permission } from "@martly/shared/constants";
import { createStorePostSchema, storePickSchema, storePostAudienceSchema, translateVoiceSchema, updateStorePostSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { notifyStorePost, postAudience } from "../../services/store-voice/notify.js";
import { aislePicks, savePick } from "../../services/store-voice/picks.js";
import { createStorePost, postForEdit, storePosts, updateStorePost } from "../../services/store-voice/posts.js";
import { previewTranslation, translateStorePick, translateStorePost } from "../../services/translate/store-voice.js";

const storeQuery = z.object({ storeId: z.string().uuid() });
const pickKey = z.object({ storeId: z.string().uuid(), productId: z.string().uuid() });
const idParams = z.object({ id: z.string().uuid() });
const owner = { preHandler: [authenticate, requirePermission(Permission.LISTING_MANAGE)] };

/** The owner speaking in the app: posts to shoppers and owner's picks. Shoppers read live posts; the store's team writes */
export async function storeVoiceRoutes(app: FastifyInstance) {
  // A store the signed-in team member may speak for; replies 403 (and returns false) otherwise
  const mayManage = async (request: FastifyRequest, reply: FastifyReply, storeId: string) => {
    if (await verifyStoreOrgAccess(request, app.prisma, storeId)) return true;
    reply.forbidden("No access to this store");
    return false;
  };

  app.get("/posts/live", async (request, reply) => {
    const query = storeQuery.safeParse(request.query);
    if (!query.success) return reply.badRequest("storeId is required");
    const data = await storePosts(app.prisma, query.data.storeId, { live: true });
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // How many shoppers a post would notify, and whether that's the aisles' buyers or every recent shopper
  app.post("/audience", owner, async (request, reply) => {
    const body = storePostAudienceSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    if (!(await mayManage(request, reply, body.data.storeId))) return;
    const { userIds, scope, aisleBuyers } = await postAudience(app.prisma, body.data.storeId, body.data.kind, body.data.productIds);
    const data = { count: userIds.length, scope, aisleBuyers: aisleBuyers ?? null };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  // What shoppers in the other language would read, while the owner is still writing; null when it can't be made now
  app.post("/translate", owner, async (request, reply) => {
    const body = translateVoiceSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    const data = await previewTranslation(body.data.text, request.log);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.get("/posts", owner, async (request, reply) => {
    const query = storeQuery.safeParse(request.query);
    if (!query.success) return reply.badRequest("storeId is required");
    if (!(await mayManage(request, reply, query.data.storeId))) return;
    const data = await storePosts(app.prisma, query.data.storeId, { live: false });
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.post("/posts", owner, async (request, reply) => {
    const body = createStorePostSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    if (!(await mayManage(request, reply, body.data.storeId))) return;
    const userId = getOrgUser(request).sub;
    const post = await createStorePost(app.prisma, userId, body.data);
    if (!post) return reply.badRequest("A tagged product isn't listed at the store");
    void translateStorePost(app.prisma, post.id, app.log);
    const notified = body.data.notify ? await notifyStorePost(app.fcm, app.prisma, post.id, userId) : false;
    const data = { id: post.id, notified };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.get("/posts/:id", owner, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.badRequest("Invalid post");
    const data = await postForEdit(app.prisma, params.data.id);
    if (!data) return reply.notFound("Post not found");
    if (!(await mayManage(request, reply, data.storeId))) return;
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.put("/posts/:id", owner, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = updateStorePostSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.badRequest(body.success ? "Invalid post" : body.error.issues[0].message);
    const post = await app.prisma.storePost.findUnique({ where: { id: params.data.id }, select: { id: true, storeId: true, text: true } });
    if (!post) return reply.notFound("Post not found");
    if (!(await mayManage(request, reply, post.storeId))) return;
    if (!(await updateStorePost(app.prisma, post, body.data))) return reply.badRequest("A tagged product isn't listed at the store");
    void translateStorePost(app.prisma, post.id, app.log);
    const notified = body.data.notify ? await notifyStorePost(app.fcm, app.prisma, post.id, getOrgUser(request).sub) : false;
    const data = { id: post.id, notified };
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.delete("/posts/:id", owner, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.badRequest("Invalid post");
    const post = await app.prisma.storePost.findUnique({ where: { id: params.data.id }, select: { storeId: true } });
    if (!post) return reply.notFound("Post not found");
    if (!(await mayManage(request, reply, post.storeId))) return;
    await app.prisma.storePost.delete({ where: { id: params.data.id } });
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  app.get("/picks", owner, async (request, reply) => {
    const query = pickKey.safeParse(request.query);
    if (!query.success) return reply.badRequest("storeId and productId are required");
    if (!(await mayManage(request, reply, query.data.storeId))) return;
    const data = await aislePicks(app.prisma, query.data.storeId, query.data.productId);
    return { success: true, data } satisfies ApiResponse<typeof data>;
  });

  app.put("/picks", owner, async (request, reply) => {
    const body = storePickSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest(body.error.issues[0].message);
    if (!(await mayManage(request, reply, body.data.storeId))) return;
    const result = await savePick(app.prisma, getOrgUser(request).sub, body.data);
    if (!result.ok && result.reason === "NOT_LISTED") return reply.badRequest("This product isn't listed at the store");
    if (!result.ok) return reply.conflict(`${MAX_PICKS_PER_AISLE} picks an aisle: remove one first`);
    void translateStorePick(app.prisma, result.id, app.log);
    return { success: true, data: { id: result.id } } satisfies ApiResponse<{ id: string }>;
  });

  app.delete("/picks", owner, async (request, reply) => {
    const query = pickKey.safeParse(request.query);
    if (!query.success) return reply.badRequest("storeId and productId are required");
    if (!(await mayManage(request, reply, query.data.storeId))) return;
    await app.prisma.storePick.deleteMany({ where: query.data });
    return { success: true, data: null } satisfies ApiResponse<null>;
  });
}
