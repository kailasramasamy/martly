import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AI_IMAGE_COST, Permission, SECTION_COLLECTION, THEME_BAND_MAX_TILES } from "@martly/shared/constants";
import {
  createHomeSectionSchema, homeSectionArtSchema, homeSectionItemsSchema, parseHomeSectionConfig, reorderHomeSectionsSchema, updateHomeSectionSchema,
} from "@martly/shared/schemas";
import type { Prisma } from "../../../generated/prisma/client.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { DEFAULT_LAYOUT } from "../../services/home/default-layout.js";
import { SECTION_INCLUDE, toEntry } from "../../services/home/layout.js";
import { sectionVisibility } from "../../services/home/visibility.js";
import { paintTiles } from "../../services/home/tile-art.js";
import { refundAiImages, withAiImages } from "../../services/marketing/ai-images.js";
import { meteredOrg } from "../../services/marketing/metered-org.js";
import type { LayoutEntry, ResolveContext } from "../../services/home/types.js";

const GRID_TYPES: string[] = ["EXPLORE_GRID", "STORE_GRID"];

const badRequest = (message: string) => Object.assign(new Error(message), { statusCode: 400 });
const json = (value: unknown) => value as Prisma.InputJsonValue;

// Collections a hero carousel's cards and "Right now" slots point at
function configCollections(type: string, config: Record<string, unknown>) {
  if (type !== "HERO_CARDS") return [];
  const hero = config as { cards: { collectionId?: string }[]; rightNow: Record<string, string> };
  return [...hero.cards.map((c) => c.collectionId), ...Object.values(hero.rightNow)];
}

// The organisation being edited: the caller's own, or the one a SUPER_ADMIN names
function layoutOrg(request: FastifyRequest, reply: FastifyReply) {
  const user = getOrgUser(request);
  const organizationId = user.role === "SUPER_ADMIN" ? (request.query as { organizationId?: string }).organizationId : user.organizationId;
  if (!organizationId) void reply.badRequest("organizationId is required");
  return organizationId;
}

export async function homeLayoutRoutes(app: FastifyInstance) {
  const guard = { preHandler: [authenticate, requirePermission(Permission.CATALOG_COLLECTIONS)] };

  // Collections a section may show: the organisation's own or global
  async function assertCollections(organizationId: string, ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) return;
    const found = await app.prisma.collection.count({ where: { id: { in: wanted }, OR: [{ organizationId }, { organizationId: null }] } });
    if (found !== wanted.length) throw badRequest("A collection is not available to this organization");
  }

  async function ownSection(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const section = await app.prisma.homeSection.findUnique({ where: { id: request.params.id }, include: SECTION_INCLUDE });
    if (!section) return void reply.notFound("Section not found");
    const user = getOrgUser(request);
    if (user.role !== "SUPER_ADMIN" && section.organizationId !== user.organizationId) return void reply.forbidden("Access denied");
    return section;
  }

  app.get("/", guard, async (request, reply) => {
    const organizationId = layoutOrg(request, reply);
    if (!organizationId) return;
    const sections = await app.prisma.homeSection.findMany({
      where: { organizationId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: SECTION_INCLUDE,
    });
    if (sections.length > 0) return { success: true, data: { isDefault: false, sections } };
    return { success: true, data: { isDefault: true, sections: DEFAULT_LAYOUT } };
  });

  app.post("/customize", guard, async (request, reply) => {
    const organizationId = layoutOrg(request, reply);
    if (!organizationId) return;
    await app.prisma.$transaction(async (tx) => {
      if (await tx.homeSection.count({ where: { organizationId } })) return;
      await tx.homeSection.createMany({
        data: DEFAULT_LAYOUT.map((e, sortOrder) => ({ organizationId, type: e.type, sortOrder, config: {} })),
      });
    });
    const sections = await app.prisma.homeSection.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" }, include: SECTION_INCLUDE });
    return { success: true, data: { isDefault: false, sections } };
  });

  app.post("/", guard, async (request, reply) => {
    const organizationId = layoutOrg(request, reply);
    if (!organizationId) return;
    const input = createHomeSectionSchema.parse(request.body);
    const config = parseHomeSectionConfig(input.type, input.config);
    if (SECTION_COLLECTION[input.type] === "REQUIRED" && !input.collectionId) throw badRequest("This section needs a collection");
    if (!SECTION_COLLECTION[input.type] && input.collectionId) throw badRequest("This section doesn't take a collection");
    await assertCollections(organizationId, [input.collectionId, ...configCollections(input.type, config)]);
    const last = await app.prisma.homeSection.aggregate({ where: { organizationId }, _max: { sortOrder: true } });
    const section = await app.prisma.homeSection.create({
      data: {
        organizationId, type: input.type, title: input.title, subtitle: input.subtitle, translations: input.translations,
        collectionId: input.collectionId, config: json(config), isActive: input.isActive, sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      include: SECTION_INCLUDE,
    });
    reply.code(201);
    return { success: true, data: section };
  });

  app.patch<{ Params: { id: string } }>("/:id", guard, async (request, reply) => {
    const section = await ownSection(request, reply);
    if (!section) return;
    const input = updateHomeSectionSchema.parse(request.body);
    const config = input.config && parseHomeSectionConfig(section.type, input.config);
    await assertCollections(section.organizationId, [input.collectionId, ...(config ? configCollections(section.type, config) : [])]);
    if (input.collectionId === null && SECTION_COLLECTION[section.type] === "REQUIRED") throw badRequest("This section needs a collection");
    if (input.collectionId && !SECTION_COLLECTION[section.type]) throw badRequest("This section doesn't take a collection");
    const updated = await app.prisma.homeSection.update({
      where: { id: section.id },
      data: {
        title: input.title, subtitle: input.subtitle, translations: input.translations, collectionId: input.collectionId,
        isActive: input.isActive, ...(config ? { config: json(config) } : {}),
      },
      include: SECTION_INCLUDE,
    });
    return { success: true, data: updated };
  });

  app.delete<{ Params: { id: string } }>("/:id", guard, async (request, reply) => {
    const section = await ownSection(request, reply);
    if (!section) return;
    await app.prisma.homeSection.delete({ where: { id: section.id } });
    return { success: true, data: { id: section.id } };
  });

  app.put("/order", guard, async (request, reply) => {
    const organizationId = layoutOrg(request, reply);
    if (!organizationId) return;
    const { ids } = reorderHomeSectionsSchema.parse(request.body);
    const owned = await app.prisma.homeSection.count({ where: { id: { in: ids }, organizationId } });
    if (owned !== new Set(ids).size) throw badRequest("Every section must belong to this organization");
    await app.prisma.$transaction(ids.map((id, sortOrder) => app.prisma.homeSection.update({ where: { id }, data: { sortOrder } })));
    return { success: true, data: { ids } };
  });

  app.put<{ Params: { id: string } }>("/:id/items", guard, async (request, reply) => {
    const section = await ownSection(request, reply);
    if (!section) return;
    const { items } = homeSectionItemsSchema.parse(request.body);
    if ([...GRID_TYPES, "TABBED_ROW"].includes(section.type) && items.some((i) => !i.collectionId)) {
      throw badRequest("Every tile needs a collection to open");
    }
    if (section.type === "THEME_BAND") {
      if (items.length > THEME_BAND_MAX_TILES) throw badRequest(`A theme band holds at most ${THEME_BAND_MAX_TILES} tiles`);
      if (items.some((i) => i.subcategoryIds.length !== 1 || i.collectionId)) throw badRequest("Each band tile opens exactly one aisle");
    }
    await assertCollections(section.organizationId, items.map((i) => i.collectionId));
    await app.prisma.$transaction([
      app.prisma.homeSectionItem.deleteMany({ where: { sectionId: section.id } }),
      app.prisma.homeSectionItem.createMany({
        data: items.map((item, sortOrder) => ({
          sectionId: section.id, label: item.label, translations: item.translations ? json(item.translations) : undefined,
          imageUrl: item.imageUrl, collectionId: item.collectionId, subcategoryIds: item.subcategoryIds, wide: item.wide, sortOrder,
        })),
      }),
    ]);
    const fresh = await app.prisma.homeSection.findUniqueOrThrow({ where: { id: section.id }, include: SECTION_INCLUDE });
    return { success: true, data: fresh };
  });

  // Paints art for a grid's tiles: the named ones, or every tile still without an image
  app.post<{ Params: { id: string } }>("/:id/art", guard, async (request, reply) => {
    const section = await ownSection(request, reply);
    if (!section) return;
    if (!GRID_TYPES.includes(section.type)) throw badRequest("Only Explore and Shop by store tiles take painted art");
    const { itemIds, repaint } = homeSectionArtSchema.parse(request.body ?? {});
    const items = section.items.filter((i) => (itemIds ? itemIds.includes(i.id) : true) && (repaint || !i.imageUrl));
    const { painted, failed } = await withAiImages(
      app, meteredOrg(getOrgUser(request), section.organizationId), items.length * AI_IMAGE_COST.HOME_TILE, "HOME_TILES", section.id,
      async (charge) => {
        const result = await paintTiles(app.prisma, items);
        await refundAiImages(app.prisma, charge, result.failed * AI_IMAGE_COST.HOME_TILE);
        return result;
      },
    );
    return { success: true, data: { painted, failed } };
  });

  // Which of the organisation's sections show at a given store, for the admin's "hidden at this store" hint
  app.get<{ Querystring: { storeId?: string } }>("/preview", guard, async (request, reply) => {
    const organizationId = layoutOrg(request, reply);
    if (!organizationId) return;
    const store = await app.prisma.store.findFirst({ where: { id: request.query.storeId, organizationId }, select: { id: true, organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const ctx: ResolveContext = { prisma: app.prisma, store, userId: "", now: new Date(), shelves: "grid" };
    const sections = await app.prisma.homeSection.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" }, include: SECTION_INCLUDE });
    const entries: LayoutEntry[] = sections.length > 0 ? sections.map(toEntry) : DEFAULT_LAYOUT;
    const data = (await sectionVisibility(ctx, entries)).map(({ entry, resolves }) => ({ id: entry.id, resolves }));
    return { success: true, data };
  });
}
