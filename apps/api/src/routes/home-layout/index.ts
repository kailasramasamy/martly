import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Permission, SECTION_COLLECTION } from "@martly/shared/constants";
import {
  createHomeSectionSchema, homeSectionItemsSchema, parseHomeSectionConfig, reorderHomeSectionsSchema, updateHomeSectionSchema,
} from "@martly/shared/schemas";
import type { Prisma } from "../../../generated/prisma/client.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { DEFAULT_LAYOUT } from "../../services/home/default-layout.js";
import { expandLayout, SECTION_INCLUDE, toEntry } from "../../services/home/layout.js";
import { RESOLVERS } from "../../services/home/registry.js";
import type { LayoutEntry, ResolveContext } from "../../services/home/types.js";

const badRequest = (message: string) => Object.assign(new Error(message), { statusCode: 400 });
const json = (value: unknown) => value as Prisma.InputJsonValue;

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
    await assertCollections(organizationId, [input.collectionId]);
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
    if (input.collectionId) await assertCollections(section.organizationId, [input.collectionId]);
    if (input.collectionId === null && SECTION_COLLECTION[section.type] === "REQUIRED") throw badRequest("This section needs a collection");
    if (input.collectionId && !SECTION_COLLECTION[section.type]) throw badRequest("This section doesn't take a collection");
    const updated = await app.prisma.homeSection.update({
      where: { id: section.id },
      data: {
        title: input.title, subtitle: input.subtitle, translations: input.translations, collectionId: input.collectionId,
        isActive: input.isActive, ...(input.config ? { config: json(parseHomeSectionConfig(section.type, input.config)) } : {}),
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

  // Which of the organisation's sections show at a given store, for the admin's "hidden at this store" hint
  app.get<{ Querystring: { storeId?: string } }>("/preview", guard, async (request, reply) => {
    const organizationId = layoutOrg(request, reply);
    if (!organizationId) return;
    const store = await app.prisma.store.findFirst({ where: { id: request.query.storeId, organizationId }, select: { id: true, organizationId: true } });
    if (!store) return reply.notFound("Store not found");
    const ctx: ResolveContext = { prisma: app.prisma, store, userId: "", now: new Date() };
    const sections = await app.prisma.homeSection.findMany({ where: { organizationId }, orderBy: { sortOrder: "asc" }, include: SECTION_INCLUDE });
    const entries: LayoutEntry[] = sections.length > 0 ? sections.map(toEntry) : DEFAULT_LAYOUT;
    const data = await Promise.all(entries.map(async (entry) => {
      const expanded = await expandLayout(ctx, [entry]);
      const resolved = await Promise.all(expanded.map((e) => RESOLVERS[e.type](ctx, e)));
      return { id: entry.id, resolves: resolved.some((s) => s !== null) };
    }));
    return { success: true, data };
  });
}
