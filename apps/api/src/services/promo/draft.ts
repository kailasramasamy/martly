import type { FastifyBaseLogger } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildBannerSet } from "../seasonal/banner-set.js";
import { bannerFields } from "../seasonal/index.js";
import { runPromoAgent } from "./agent.js";
import { describeProducts, referenceStoreId } from "./catalog.js";
import { judgeProducts } from "./judge.js";
import { MIN_PRODUCTS, type PromoSubmission } from "./tools.js";

// A draft that hasn't finished in this long was cut off by a restart
const STALE_DRAFT_MS = 10 * 60 * 1000;

export interface PromoDeps {
  prisma: PrismaClient;
  log: FastifyBaseLogger;
}

export class PromoFailure extends Error {}

export async function logStep(prisma: PrismaClient, promoId: string, message: string) {
  await prisma.$executeRaw`
    UPDATE promos SET agent_log = agent_log || jsonb_build_array(jsonb_build_object('at', now(), 'message', ${message}::text)),
      updated_at = now()
    WHERE id = ${promoId}`;
}

export async function failPromo(prisma: PrismaClient, promoId: string, reason: string) {
  await logStep(prisma, promoId, `Failed: ${reason}`);
  // A promo that already went live stays live; only drafting or ready ones fail
  await prisma.promo.updateMany({ where: { id: promoId, status: { in: ["DRAFTING", "READY"] } }, data: { status: "FAILED", failureReason: reason } });
}

/** Runs the agent, then the relevance check; returns the submission with only the products that passed. */
async function curate(prisma: PrismaClient, promo: { id: string; organizationId: string; brief: string }) {
  const [storeId, org] = await Promise.all([
    referenceStoreId(prisma, promo.organizationId),
    prisma.organization.findUniqueOrThrow({ where: { id: promo.organizationId }, select: { promoDiscountCap: true } }),
  ]);
  if (!storeId) throw new PromoFailure("This organisation has no active store with products");
  const step = (message: string) => logStep(prisma, promo.id, message);
  await step("Reading the brief");
  const outcome = await runPromoAgent({ prisma, organizationId: promo.organizationId, storeId, brief: promo.brief, discountCap: org.promoDiscountCap }, step);
  if (!outcome) throw new PromoFailure("The agent stopped without choosing products");
  if (outcome.kind === "gave_up") throw new PromoFailure(outcome.reason);
  await step(`Checking ${outcome.promo.productIds.length} products against the brief`);
  const facts = await describeProducts(prisma, promo.organizationId, outcome.promo.productIds);
  const { kept, dropped } = await judgeProducts(promo.brief, facts);
  if (dropped.length) await step(`Dropped as off-topic: ${dropped.join(", ")}`);
  if (kept.length < MIN_PRODUCTS) throw new PromoFailure(`Only ${kept.length} products fit the brief; a promo needs at least ${MIN_PRODUCTS}`);
  return { ...outcome.promo, productIds: kept.map((p) => p.id) };
}

/** Paints the banner and stores the draft as an inactive PROMO collection, ready for launch. */
async function saveDraft(prisma: PrismaClient, log: FastifyBaseLogger, promo: { id: string; organizationId: string }, draft: PromoSubmission) {
  await logStep(prisma, promo.id, "Painting the banner (English and Tamil)");
  const slug = `promo-${promo.id}`;
  const art = await buildBannerSet(draft.bannerScene, { en: draft.copy.en, ta: draft.copy.ta }, slug, (m) => log.warn(`${slug}: ${m}`));
  await prisma.$transaction(async (tx) => {
    const collection = await tx.collection.create({
      data: {
        organizationId: promo.organizationId, slug, kind: "PROMO", source: "AGENT", isActive: false,
        title: draft.copy.en.title, subtitle: draft.copy.en.subtitle, artDirection: draft.bannerScene,
        translations: { ta: draft.copy.ta }, ...bannerFields(art),
        items: { create: draft.productIds.map((productId, sortOrder) => ({ productId, sortOrder })) },
      },
    });
    await tx.promo.update({
      where: { id: promo.id },
      data: {
        status: "READY", collectionId: collection.id, copy: draft.copy, push: draft.push, assumptions: draft.assumptions,
        discountType: draft.discount?.type ?? null, discountValue: draft.discount?.value ?? null, durationDays: draft.durationDays,
      },
    });
  });
  await logStep(prisma, promo.id, "Ready to launch");
}

/** The whole background draft: any failure lands on the promo as FAILED with a reason the admin can read. */
export async function runDraft(deps: PromoDeps, promo: { id: string; organizationId: string; brief: string }) {
  const draft = await curate(deps.prisma, promo);
  await saveDraft(deps.prisma, deps.log, promo, draft);
}

/** Drafts cut off by a restart would otherwise spin forever in the admin. */
export async function failStaleDrafts(prisma: PrismaClient) {
  const stale = await prisma.promo.findMany({
    where: { status: "DRAFTING", updatedAt: { lt: new Date(Date.now() - STALE_DRAFT_MS) } },
    select: { id: true },
  });
  for (const { id } of stale) await failPromo(prisma, id, "Drafting was interrupted; try again");
}
