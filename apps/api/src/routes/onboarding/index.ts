import type { FastifyInstance } from "fastify";
import {
  applyCatalogSchema, catalogProposalSchema, catalogRulesSchema, copyStorefrontSchema, createOnboardingSchema, onboardingStaffSchema,
  updateOnboardingSchema,
} from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/authorize.js";
import { createOnboarding, updateOnboarding } from "../../services/onboarding/create.js";
import { getOnboarding, listOnboarding } from "../../services/onboarding/summary.js";
import { catalogProposal } from "../../services/onboarding/catalog-proposal.js";
import { applyCatalog, unpricedProposal } from "../../services/onboarding/catalog-apply.js";
import { copyStorefront } from "../../services/onboarding/storefront-copy.js";
import { addTeamMember, listTeam, removeTeamMember } from "../../services/onboarding/team.js";
import { readiness } from "../../services/onboarding/readiness.js";
import { launchStore } from "../../services/onboarding/launch.js";
import { notifyStoreStatusChange } from "../../services/notify/team-alerts.js";

type Params = { Params: { storeId: string } };
type MemberParams = { Params: { storeId: string; userId: string } };

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });
const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data });

/** Martly sets up new organisations and their first store; everything here is for Martly's own team */
export async function onboardingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole("SUPER_ADMIN"));

  /** A store still being set up: changes are only allowed before launch */
  async function pendingStore(storeId: string) {
    const store = await app.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw fail("Store not found", 404);
    if (store.status !== "PENDING") throw fail("This store has launched; manage it from Stores", 409);
    return store;
  }

  async function sizedStore(storeId: string) {
    const store = await pendingStore(storeId);
    if (!store.size) throw fail("Choose the store size first", 400);
    return { id: store.id, state: store.state, size: store.size };
  }

  app.get("/", async () => ok(await listOnboarding(app.prisma)));

  app.get("/templates", async () =>
    ok(await app.prisma.organization.findMany({ where: { isTemplate: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })));

  app.post("/", async (request) => {
    const store = await createOnboarding(app.prisma, createOnboardingSchema.parse(request.body));
    return ok(await getOnboarding(app.prisma, store.id));
  });

  app.get<Params>("/:storeId", async (request, reply) => {
    const onboarding = await getOnboarding(app.prisma, request.params.storeId);
    return onboarding ? ok(onboarding) : reply.notFound("Store not found");
  });

  app.patch<Params>("/:storeId", async (request) => {
    await pendingStore(request.params.storeId);
    await updateOnboarding(app.prisma, request.params.storeId, updateOnboardingSchema.parse(request.body));
    return ok(await getOnboarding(app.prisma, request.params.storeId));
  });

  app.get<Params>("/:storeId/team", async (request) => ok(await listTeam(app.prisma, request.params.storeId)));

  app.post<Params>("/:storeId/team", async (request) => {
    const store = await pendingStore(request.params.storeId);
    await addTeamMember(app.prisma, store, onboardingStaffSchema.parse(request.body));
    return ok(await listTeam(app.prisma, store.id));
  });

  app.delete<MemberParams>("/:storeId/team/:userId", async (request) => {
    const store = await pendingStore(request.params.storeId);
    await removeTeamMember(app.prisma, store.id, request.params.userId);
    return ok(await listTeam(app.prisma, store.id));
  });

  app.post<Params>("/:storeId/catalog/proposal", async (request) => {
    const { subcategoryId, ...rules } = catalogProposalSchema.parse(request.body ?? {});
    return ok(await catalogProposal(app.prisma, await sizedStore(request.params.storeId), rules, subcategoryId));
  });

  app.post<Params>("/:storeId/catalog/unpriced", async (request) =>
    ok(await unpricedProposal(app.prisma, await sizedStore(request.params.storeId), catalogRulesSchema.parse(request.body ?? {}))));

  app.post<Params>("/:storeId/catalog/apply", async (request) => {
    const store = await sizedStore(request.params.storeId);
    return ok(await applyCatalog(app.prisma, store, applyCatalogSchema.parse(request.body), request.user.sub));
  });

  app.post<Params>("/:storeId/storefront", async (request) => {
    const store = await pendingStore(request.params.storeId);
    const input = copyStorefrontSchema.parse(request.body);
    const template = await app.prisma.organization.findFirst({ where: { id: input.templateOrganizationId, isTemplate: true } });
    if (!template) throw fail("Pick a template organisation", 400);
    if (!(await app.prisma.storeProduct.count({ where: { storeId: store.id } }))) throw fail("Apply the catalog first: copied collections keep only products the store sells", 400);
    return ok(await copyStorefront(app.prisma, store, input));
  });

  app.get<Params>("/:storeId/readiness", async (request) => ok(await readiness(app.prisma, request.params.storeId)));

  app.post<Params>("/:storeId/launch", async (request) => {
    const store = await pendingStore(request.params.storeId);
    const blocking = (await readiness(app.prisma, store.id)).filter((c) => c.required && !c.ok);
    if (blocking.length) throw fail(`Not ready: ${blocking.map((c) => c.label).join(", ")}`, 409);
    const launched = await launchStore(app.prisma, store.id);
    void notifyStoreStatusChange(app.fcm, app.prisma, launched, store.status, launched.status);
    return ok(await getOnboarding(app.prisma, store.id));
  });
}
