import type { FastifyInstance } from "fastify";
import { createFestivalEventSchema, updateFestivalEventSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { getOrgUser } from "../../middleware/org-scope.js";
import { matchesRegions } from "../../services/seasonal/due-events.js";
import { curateEvent, isCurationConfigured, type CurationResult } from "../../services/seasonal/index.js";

export async function festivalEventRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };

  app.get("/", { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] }, async (request) => {
    const { page = 1, pageSize = 50 } = request.query as { page?: number; pageSize?: number };
    const user = getOrgUser(request);
    const org = user.role === "ORG_ADMIN"
      ? await app.prisma.organization.findUnique({ where: { id: user.organizationId! }, select: { festivalRegions: true } })
      : null;
    // ORG_ADMIN only sees the calendar for the regions their org follows
    const where = org ? { OR: [{ regions: { has: "ALL" } }, { regions: { hasSome: org.festivalRegions } }] } : {};
    const [events, total] = await Promise.all([
      app.prisma.festivalEvent.findMany({
        where,
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        orderBy: { startsAt: "asc" },
        include: {
          collections: {
            where: org ? { organizationId: user.organizationId } : {},
            select: { id: true, title: true, isActive: true, source: true, organizationId: true },
          },
        },
      }),
      app.prisma.festivalEvent.count({ where }),
    ]);
    const response: PaginatedResponse<(typeof events)[0]> = {
      success: true,
      data: events,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  app.get<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const event = await app.prisma.festivalEvent.findUnique({ where: { id: request.params.id } });
    if (!event) return reply.notFound("Festival event not found");
    const response: ApiResponse<typeof event> = { success: true, data: event };
    return response;
  });

  app.post("/", adminOnly, async (request) => {
    const event = await app.prisma.festivalEvent.create({ data: createFestivalEventSchema.parse(request.body) });
    const response: ApiResponse<typeof event> = { success: true, data: event };
    return response;
  });

  app.put<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const body = updateFestivalEventSchema.parse(request.body);
    const existing = await app.prisma.festivalEvent.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Festival event not found");
    const event = await app.prisma.festivalEvent.update({ where: { id: existing.id }, data: body });
    const response: ApiResponse<typeof event> = { success: true, data: event };
    return response;
  });

  app.delete<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const existing = await app.prisma.festivalEvent.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Festival event not found");
    await app.prisma.festivalEvent.delete({ where: { id: existing.id } });
    return { success: true, data: null };
  });

  // Runs the curator immediately instead of waiting for the scheduler's review window
  app.post<{ Params: { id: string } }>(
    "/:id/curate",
    { preHandler: [authenticate, requireRole("SUPER_ADMIN", "ORG_ADMIN")] },
    async (request, reply) => {
      if (!isCurationConfigured()) return reply.serviceUnavailable("Curation needs ANTHROPIC_API_KEY and OPENAI_API_KEY");
      const event = await app.prisma.festivalEvent.findUnique({ where: { id: request.params.id } });
      if (!event) return reply.notFound("Festival event not found");
      if (event.endsAt < new Date()) return reply.badRequest("This event has already ended");

      const user = getOrgUser(request);
      const orgs = await app.prisma.organization.findMany({
        where: user.role === "ORG_ADMIN" ? { id: user.organizationId } : {},
        select: { id: true, name: true, slug: true, festivalRegions: true },
      });
      const targets = orgs.filter((org) => matchesRegions(event, org));
      if (targets.length === 0) return reply.badRequest("No organization follows this event's regions");

      const results: ({ organizationId: string } & CurationResult)[] = [];
      for (const org of targets) {
        results.push({ organizationId: org.id, ...(await curateEvent(app.prisma, org, event, (msg) => request.log.warn(`${org.slug} / ${event.slug}: ${msg}`))) });
      }
      const response: ApiResponse<typeof results> = { success: true, data: results };
      return response;
    },
  );
}
