import type { FastifyInstance, FastifyReply } from "fastify";
import { createTownSchema, townQuerySchema, updateTownSchema } from "@martly/shared/schemas";
import type { ApiResponse, PaginatedResponse, Town } from "@martly/shared/types";
import { Prisma } from "../../../generated/prisma/client.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { townSelect } from "../../services/towns.js";

/** Runs a town write; a taken slug or a town already listed in that district becomes a 409, a missing town a 404 */
async function write(reply: FastifyReply, run: () => Promise<Town>) {
  try {
    return { success: true, data: await run() } satisfies ApiResponse<Town>;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) throw err;
    if (err.code === "P2002") return reply.conflict("That town is already in the list, or another town uses that address");
    if (err.code === "P2025") return reply.notFound("Town not found");
    throw err;
  }
}

const adminOnly = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };

export async function townRoutes(app: FastifyInstance) {
  // Anyone setting up a store picks its town from Martly's list
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = townQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    const { q, page, pageSize } = parsed.data;
    const where: Prisma.TownWhereInput = q ? { name: { contains: q, mode: "insensitive" } } : {};
    const [rows, total] = await Promise.all([
      app.prisma.town.findMany({ where, select: townSelect, orderBy: [{ name: "asc" }, { district: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.town.count({ where }),
    ]);
    return { success: true, data: rows, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } } satisfies PaginatedResponse<Town>;
  });

  app.get<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const town = await app.prisma.town.findUnique({ where: { id: request.params.id }, select: townSelect });
    if (!town) return reply.notFound("Town not found");
    return { success: true, data: town } satisfies ApiResponse<Town>;
  });

  app.post("/", adminOnly, async (request, reply) => {
    const body = createTownSchema.parse(request.body);
    return write(reply, () => app.prisma.town.create({ data: body, select: townSelect }));
  });

  // Stores copy the town's district and state, so a corrected region follows to them
  app.put<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const body = updateTownSchema.parse(request.body);
    return write(reply, () => app.prisma.$transaction(async (tx) => {
      const town = await tx.town.update({ where: { id: request.params.id }, data: body, select: townSelect });
      await tx.store.updateMany({ where: { townId: town.id }, data: { district: town.district, state: town.state } });
      return town;
    }));
  });
}
