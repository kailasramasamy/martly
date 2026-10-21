import type { FastifyInstance } from "fastify";
import { addShoppingListItemSchema, addShoppingListItemsSchema, buildShoppingListSchema, shoppingListDoneSchema, updateShoppingListItemSchema } from "@martly/shared/schemas";
import type { ApiResponse, RecentList } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { streamBuild } from "../../services/cart-builder/stream.js";
import { createRateLimiter } from "../../services/rate-limit.js";

const MAX_OPEN_ITEMS = 100;
const checkRateLimit = createRateLimiter(10, 60_000);
const itemSelect = { id: true, text: true, createdAt: true } as const;
const RECENT_LISTS = 5;
// Runs read to find them: rebuilding the same list adds runs, so read past the duplicates
const RECENT_RUNS_READ = 30;

/** Words compared the way a shopper would: case and spacing don't make a different item */
const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

// A customer's own list, so every query is filtered by userId rather than org
function itemRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const user = getOrgUser(request);
    const items = await app.prisma.shoppingListItem.findMany({
      where: { userId: user.sub, doneAt: null },
      orderBy: { createdAt: "asc" },
      select: itemSelect,
    });
    return { success: true, data: items } satisfies ApiResponse<typeof items>;
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = addShoppingListItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const open = await app.prisma.shoppingListItem.count({ where: { userId: user.sub, doneAt: null } });
    if (open >= MAX_OPEN_ITEMS) return reply.badRequest("Your list is full");

    const item = await app.prisma.shoppingListItem.create({
      data: { userId: user.sub, text: parsed.data.text },
      select: itemSelect,
    });
    return { success: true, data: item } satisfies ApiResponse<typeof item>;
  });

  app.patch<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = updateShoppingListItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const { count } = await app.prisma.shoppingListItem.updateMany({
      where: { id: request.params.id, userId: user.sub, doneAt: null },
      data: { text: parsed.data.text },
    });
    if (count === 0) return reply.notFound("Item not found");
    return { success: true, data: null } satisfies ApiResponse<null>;
  });

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const { count } = await app.prisma.shoppingListItem.deleteMany({ where: { id: request.params.id, userId: user.sub } });
    if (count === 0) return reply.notFound("Item not found");
    return { success: true, data: null } satisfies ApiResponse<null>;
  });
}

function cartRoutes(app: FastifyInstance) {
  // Matches the whole list against a store; items stay on the list until the customer marks them done
  app.post("/build", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = buildShoppingListSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    if (!checkRateLimit(user.sub)) return reply.tooManyRequests("Too many lists. Please wait a moment.");

    const store = await app.prisma.store.findFirst({ where: { id: parsed.data.storeId, status: "ACTIVE" }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    const items = await app.prisma.shoppingListItem.findMany({
      where: { userId: user.sub, doneAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, text: true },
    });
    if (items.length === 0) return reply.badRequest("Your list is empty");

    const text = items.map((i) => i.text).join("\n");
    const input = { userId: user.sub, storeId: store.id, text, source: "LIST" as const, language: parsed.data.language };
    await streamBuild(reply, app.prisma, input, { itemIds: items.map((i) => i.id) });
  });

  app.post("/done", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = shoppingListDoneSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const { count } = await app.prisma.shoppingListItem.updateMany({
      where: { id: { in: parsed.data.ids }, userId: user.sub, doneAt: null },
      data: { doneAt: new Date() },
    });
    return { success: true, data: { count } } satisfies ApiResponse<{ count: number }>;
  });
}

/** The customer's past lists from their cart builds, newest first, one per distinct set of items */
async function recentLists(app: FastifyInstance, userId: string): Promise<RecentList[]> {
  const runs = await app.prisma.cartBuilderRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: RECENT_RUNS_READ,
    select: { id: true, createdAt: true, lines: true, store: { select: { name: true, translations: true } } },
  });
  const seen = new Set<string>();
  const lists: RecentList[] = [];
  for (const run of runs) {
    const items = (run.lines as { text?: string }[]).map((l) => l.text?.trim() ?? "").filter(Boolean);
    const key = items.map(norm).sort().join("\n");
    if (items.length === 0 || seen.has(key)) continue;
    seen.add(key);
    lists.push({ id: run.id, createdAt: run.createdAt.toISOString(), store: run.store as RecentList["store"], items });
    if (lists.length === RECENT_LISTS) break;
  }
  return lists;
}

// Lists from earlier shops, to start this one from
function historyRoutes(app: FastifyInstance) {
  app.get("/recent", { preHandler: [authenticate] }, async (request) => {
    const lists = await recentLists(app, getOrgUser(request).sub);
    return { success: true, data: lists } satisfies ApiResponse<RecentList[]>;
  });

  // Items already on the open list are skipped, so picking the same past list twice doesn't double them
  app.post("/bulk", { preHandler: [authenticate] }, async (request, reply) => {
    const user = getOrgUser(request);
    const parsed = addShoppingListItemsSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);

    const open = await app.prisma.shoppingListItem.findMany({ where: { userId: user.sub, doneAt: null }, select: { text: true } });
    const have = new Set(open.map((i) => norm(i.text)));
    const fresh: string[] = [];
    for (const text of parsed.data.texts) {
      if (have.has(norm(text))) continue;
      have.add(norm(text));
      fresh.push(text);
    }
    if (open.length + fresh.length > MAX_OPEN_ITEMS) return reply.badRequest("Your list is full");

    const items = await app.prisma.shoppingListItem.createManyAndReturn({
      data: fresh.map((text) => ({ userId: user.sub, text })),
      select: itemSelect,
    });
    return { success: true, data: items } satisfies ApiResponse<typeof items>;
  });
}

export async function shoppingListRoutes(app: FastifyInstance) {
  itemRoutes(app);
  cartRoutes(app);
  historyRoutes(app);
}
