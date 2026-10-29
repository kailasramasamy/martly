import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { authenticateOptional } from "../../middleware/auth.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { reviewSummaries, withReviews } from "../../services/store-feed.js";
import { buyAgainProducts, pastOrderLines } from "../../services/home/feed-queries.js";
import { legacyHomeFeed } from "../../services/home/legacy-feed.js";
import { homeSectionsRoutes } from "./sections.js";
import { homeSectionEventsSchema } from "@martly/shared/schemas";
import { recordHomeSectionEvents } from "../../services/storefront/events.js";

export async function homeRoutes(app: FastifyInstance) {
  await app.register(homeSectionsRoutes);

  // Views, taps and cart adds per Home section, batched by the shopper app; guests count too, so no login
  app.post("/events", async (request) => {
    const { storeId, events } = homeSectionEventsSchema.parse(request.body);
    const recorded = await recordHomeSectionEvents(app.prisma, storeId, events);
    return { success: true, data: { recorded } } satisfies ApiResponse<{ recorded: number }>;
  });

  // The whole Home in one response, for app builds before the sections Home (1.0.5 and older); only Buy Again is per shopper
  app.get<{ Params: { storeId: string } }>(
    "/:storeId",
    { preHandler: [authenticateOptional] },
    async (request, reply) => {
      const { storeId } = request.params;
      const store = await app.prisma.store.findUnique({ where: { id: storeId }, select: { id: true, organizationId: true } });
      if (!store) return reply.notFound("Store not found");

      const user = getOrgUser(request);
      const [feed, lines] = await Promise.all([
        legacyHomeFeed(app.prisma, store),
        user.sub ? pastOrderLines(app.prisma, storeId, user.sub) : Promise.resolve([]),
      ]);
      const buyAgain = await buyAgainProducts(app.prisma, storeId, lines);
      const reviews = await reviewSummaries(app.prisma, buyAgain.map((b: any) => b.productId as string));
      const { collections, departments, timeCategories, timePeriod, deals, banners, recipes, festiveHero } = feed;
      const data = {
        collections, departments, timeCategories, timePeriod, deals,
        buyAgain: withReviews(buyAgain, reviews), banners, recipes, festiveHero,
      };
      return { success: true, data } satisfies ApiResponse<typeof data>;
    },
  );
}
