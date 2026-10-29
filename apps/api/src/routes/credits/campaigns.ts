import type { FastifyInstance, FastifyRequest } from "fastify";
import { Permission, STORE_CREDIT_MAX_AMOUNT } from "@martly/shared/constants";
import { createCreditCampaignSchema, listCreditCampaignsQuerySchema, updateCreditCampaignSchema } from "@martly/shared/schemas";
import type { ApiResponse, CreditCampaignRow, PaginatedResponse } from "@martly/shared/types";
import type { Prisma } from "../../../generated/prisma/client.js";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { getOrgStoreIds, getOrgUser, verifyStoreOrgAccess } from "../../middleware/org-scope.js";
import { campaignUsage } from "../../services/credits/campaigns.js";

const include = { store: { select: { name: true } } } satisfies Prisma.CreditCampaignInclude;
type CampaignRecord = Prisma.CreditCampaignGetPayload<{ include: typeof include }>;

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

async function toRows(app: FastifyInstance, campaigns: CampaignRecord[]): Promise<CreditCampaignRow[]> {
  const usage = await campaignUsage(app.prisma, campaigns);
  return campaigns.map((c) => ({
    id: c.id, organizationId: c.organizationId, storeId: c.storeId, storeName: c.store?.name ?? null,
    amount: Number(c.amount), minOrderAmount: Number(c.minOrderAmount), validDays: c.validDays, budget: Number(c.budget),
    headline: c.headline, message: c.message, translations: c.translations as CreditCampaignRow["translations"],
    isActive: c.isActive, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(), usage: usage.get(c.id)!,
  }));
}

/** Martly's campaigns are the super admin's; a store's belong to whoever manages that store */
async function assertCanManage(app: FastifyInstance, request: FastifyRequest, storeId: string | null) {
  if (getOrgUser(request).role === "SUPER_ADMIN") return;
  if (!storeId) throw httpError("Only Martly can run Martly-funded credit", 403);
  if (!await verifyStoreOrgAccess(request, app.prisma, storeId)) throw httpError("Access denied", 403);
}

/** Stores fund their own credit, so Martly caps what one store may give; the minimum order must cover the credit */
function assertTerms(request: FastifyRequest, storeId: string | null, terms: { amount: number; minOrderAmount: number }) {
  if (terms.minOrderAmount < terms.amount) throw httpError("Minimum order must be at least the credit amount", 400);
  if (storeId && getOrgUser(request).role !== "SUPER_ADMIN" && terms.amount > STORE_CREDIT_MAX_AMOUNT) {
    throw httpError(`A store can give up to ₹${STORE_CREDIT_MAX_AMOUNT} per new customer`, 400);
  }
}

/** Staff see their stores' campaigns; only the super admin sees Martly's */
async function scopeWhere(app: FastifyInstance, request: FastifyRequest): Promise<Prisma.CreditCampaignWhereInput> {
  const { storeId, scope } = listCreditCampaignsQuerySchema.parse(request.query);
  const storeIds = await getOrgStoreIds(request, app.prisma);
  const filters: Prisma.CreditCampaignWhereInput[] = [];
  if (storeIds) filters.push({ storeId: { in: storeIds } });
  if (storeId) filters.push({ storeId });
  if (scope === "martly") filters.push({ storeId: null });
  if (scope === "store") filters.push({ storeId: { not: null } });
  return { AND: filters };
}

export async function creditCampaignRoutes(app: FastifyInstance) {
  const guard = { preHandler: [authenticate, requirePermission(Permission.MARKETING_MANAGE)] };

  app.get("/campaigns", guard, async (request) => {
    const { page, pageSize } = listCreditCampaignsQuerySchema.parse(request.query);
    const where = await scopeWhere(app, request);
    const [campaigns, total] = await Promise.all([
      app.prisma.creditCampaign.findMany({ where, include, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      app.prisma.creditCampaign.count({ where }),
    ]);
    return {
      success: true, data: await toRows(app, campaigns),
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    } satisfies PaginatedResponse<CreditCampaignRow>;
  });

  app.get<{ Params: { id: string } }>("/campaigns/:id", guard, async (request, reply) => {
    const campaign = await app.prisma.creditCampaign.findUnique({ where: { id: request.params.id }, include });
    if (!campaign) return reply.notFound("Campaign not found");
    await assertCanManage(app, request, campaign.storeId);
    const [row] = await toRows(app, [campaign]);
    return { success: true, data: row } satisfies ApiResponse<CreditCampaignRow>;
  });

  app.post("/campaigns", guard, async (request, reply) => {
    const body = createCreditCampaignSchema.parse(request.body);
    const storeId = body.storeId ?? null;
    await assertCanManage(app, request, storeId);
    assertTerms(request, storeId, body);
    const store = storeId ? await app.prisma.store.findUnique({ where: { id: storeId }, select: { organizationId: true } }) : null;
    if (storeId && !store) return reply.notFound("Store not found");
    const { storeId: _omit, translations, ...fields } = body;
    const campaign = await app.prisma.creditCampaign.create({
      data: {
        ...fields, storeId, organizationId: store?.organizationId ?? null, createdBy: getOrgUser(request).sub,
        translations: (translations ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include,
    });
    const [row] = await toRows(app, [campaign]);
    return reply.status(201).send({ success: true, data: row } satisfies ApiResponse<CreditCampaignRow>);
  });

  // Changes apply to credit given from now on; grants already made keep their amount and expiry
  app.patch<{ Params: { id: string } }>("/campaigns/:id", guard, async (request, reply) => {
    const body = updateCreditCampaignSchema.parse(request.body);
    const existing = await app.prisma.creditCampaign.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.notFound("Campaign not found");
    await assertCanManage(app, request, existing.storeId);
    assertTerms(request, existing.storeId, {
      amount: body.amount ?? Number(existing.amount), minOrderAmount: body.minOrderAmount ?? Number(existing.minOrderAmount),
    });
    const { translations, ...fields } = body;
    const campaign = await app.prisma.creditCampaign.update({
      where: { id: existing.id },
      data: { ...fields, ...(translations !== undefined ? { translations: (translations ?? {}) as Prisma.InputJsonValue } : {}) },
      include,
    });
    const [row] = await toRows(app, [campaign]);
    return { success: true, data: row } satisfies ApiResponse<CreditCampaignRow>;
  });
}
