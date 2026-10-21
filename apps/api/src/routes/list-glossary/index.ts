import type { FastifyInstance, FastifyReply } from "fastify";
import { listGlossaryActiveSchema, listGlossaryQuerySchema, listGlossaryTermSchema, type ListGlossaryTermInput } from "@martly/shared/schemas";
import type { ApiResponse, ListGlossaryTerm, PaginatedResponse } from "@martly/shared/types";
import { Prisma } from "../../../generated/prisma/client.js";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { invalidateGlossary } from "../../services/cart-builder/glossary.js";

const termSelect = {
  id: true, searchTerm: true, note: true, isActive: true, updatedAt: true,
  phrases: { select: { id: true, language: true, text: true }, orderBy: [{ language: "asc" }, { text: "asc" }] },
} satisfies Prisma.ListGlossaryTermSelect;

type TermRow = Prisma.ListGlossaryTermGetPayload<{ select: typeof termSelect }>;

const toTerm = (row: TermRow): ListGlossaryTerm => ({ ...row, updatedAt: row.updatedAt.toISOString() });

function whereFor(q?: string, language?: string): Prisma.ListGlossaryTermWhereInput {
  return {
    AND: [
      q ? { OR: [{ searchTerm: { contains: q, mode: "insensitive" } }, { phrases: { some: { text: { contains: q, mode: "insensitive" } } } }] } : {},
      language ? { phrases: { some: { language } } } : {},
    ],
  };
}

/** Runs a glossary write; a catalog word or phrase that's already taken becomes a 409, a missing term a 404 */
async function write(reply: FastifyReply, run: () => Promise<TermRow>) {
  try {
    const term = await run();
    invalidateGlossary();
    return { success: true, data: toTerm(term) } satisfies ApiResponse<ListGlossaryTerm>;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) throw err;
    if (err.code === "P2002") return reply.conflict("That catalog word, or one of these phrases in that language, is already in the glossary");
    if (err.code === "P2025") return reply.notFound("Glossary term not found");
    throw err;
  }
}

const phrasesOf = (body: ListGlossaryTermInput) => body.phrases.map(({ language, text }) => ({ language, text }));

const adminOnly = { preHandler: [authenticate, requireRole("SUPER_ADMIN")] };

function readRoutes(app: FastifyInstance) {
  app.get("/", adminOnly, async (request, reply) => {
    const parsed = listGlossaryQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    const { q, language, page, pageSize } = parsed.data;
    const where = whereFor(q, language);
    const [rows, total] = await Promise.all([
      app.prisma.listGlossaryTerm.findMany({ where, select: termSelect, orderBy: { searchTerm: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.listGlossaryTerm.count({ where }),
    ]);
    return { success: true, data: rows.map(toTerm), meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } } satisfies PaginatedResponse<ListGlossaryTerm>;
  });

  app.get<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const row = await app.prisma.listGlossaryTerm.findUnique({ where: { id: request.params.id }, select: termSelect });
    if (!row) return reply.notFound("Glossary term not found");
    return { success: true, data: toTerm(row) } satisfies ApiResponse<ListGlossaryTerm>;
  });
}

// Every write drops the API's cached glossary, so the next list is read with the change
function writeRoutes(app: FastifyInstance) {
  app.post("/", adminOnly, async (request, reply) => {
    const parsed = listGlossaryTermSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    const { searchTerm, note, isActive } = parsed.data;
    return write(reply, () => app.prisma.listGlossaryTerm.create({
      data: { searchTerm, note: note ?? null, isActive, phrases: { create: phrasesOf(parsed.data) } },
      select: termSelect,
    }));
  });

  // The term with its phrases replaced
  app.put<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const parsed = listGlossaryTermSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    const { searchTerm, note, isActive } = parsed.data;
    return write(reply, () => app.prisma.listGlossaryTerm.update({
      where: { id: request.params.id },
      data: { searchTerm, note: note ?? null, isActive, phrases: { deleteMany: {}, create: phrasesOf(parsed.data) } },
      select: termSelect,
    }));
  });

  app.patch<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const parsed = listGlossaryActiveSchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.issues[0].message);
    return write(reply, () => app.prisma.listGlossaryTerm.update({ where: { id: request.params.id }, data: parsed.data, select: termSelect }));
  });

  app.delete<{ Params: { id: string } }>("/:id", adminOnly, async (request, reply) => {
    const { count } = await app.prisma.listGlossaryTerm.deleteMany({ where: { id: request.params.id } });
    if (count === 0) return reply.notFound("Glossary term not found");
    invalidateGlossary();
    return { success: true, data: null } satisfies ApiResponse<null>;
  });
}

/** The list glossary: how shoppers say things per language and the catalog word for each. Platform-wide, Super Admin only */
export async function listGlossaryRoutes(app: FastifyInstance) {
  readRoutes(app);
  writeRoutes(app);
}
