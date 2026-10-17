import type { Messaging } from "firebase-admin/messaging";
import type { FastifyBaseLogger } from "fastify";
import type { CreateManualPromoInput } from "@martly/shared/schemas";
import type { Prisma, PrismaClient, Promo } from "../../../generated/prisma/client.js";
import { generateBannerImage } from "../marketing/banner-image.js";
import { logStep, type PromoDeps } from "./draft.js";
import { launchPromo, PromoStateError } from "./lifecycle.js";
import { productsForTarget } from "./targets.js";

class PromoInputError extends Error {
  name = "PromoInputError";
  statusCode = 400;
}

type Charge = (tx: Prisma.TransactionClient, promo: { id: string; organizationId: string }) => Promise<unknown>;
type BannerOwner = Pick<Promo, "id" | "organizationId" | "kind" | "status" | "collectionId" | "copy" | "actionType" | "actionTarget">;

const copyOf = (promo: Pick<Promo, "copy">) => (promo.copy as { en?: { title?: string; subtitle?: string } } | null)?.en;

/** A manual promotion's discount must stay under the organisation's cap and cover at least one listed product */
async function checkDiscount(prisma: PrismaClient, organizationId: string, input: CreateManualPromoInput) {
  if (!input.discountType) return;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { promoDiscountCap: true } });
  if (input.discountType === "PERCENTAGE" && input.discountValue! > org.promoDiscountCap) {
    throw new PromoInputError(`Discounts are capped at ${org.promoDiscountCap}% for your stores`);
  }
  const products = await productsForTarget(prisma, organizationId, input.actionType, input.actionTarget ?? null);
  if (!products.length) throw new PromoInputError("None of your stores list products in that target, so there's nothing to discount");
}

/**
 * Sets up a manual promotion and its one home-carousel banner as Ready, paying with a promotion credit in the
 * same transaction. It goes live now, at launchAt, or when the owner launches it.
 */
export async function createManualPromo(
  deps: PromoDeps & { fcm: Messaging | null },
  input: CreateManualPromoInput,
  owner: { organizationId: string; createdById: string },
  charge?: Charge,
) {
  if (input.launchAt && input.launchAt <= new Date()) throw new PromoInputError("Pick a launch time in the future, or launch now");
  await checkDiscount(deps.prisma, owner.organizationId, input);
  const copy = { en: { title: input.title, subtitle: input.subtitle ?? "" } };
  const promo = await deps.prisma.$transaction(async (tx) => {
    const created = await tx.promo.create({
      data: {
        ...owner, kind: "MANUAL", status: "READY", brief: input.title, copy, notify: input.notify,
        actionType: input.actionType, actionTarget: input.actionTarget ?? null, discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null, durationDays: input.durationDays, launchAt: input.launchAt ?? null,
        chargedFrom: charge ? undefined : "PLATFORM",
      },
    });
    if (charge) await charge(tx, created);
    await tx.banner.create({
      data: {
        organizationId: owner.organizationId, promoId: created.id, placement: "HERO_CAROUSEL", isActive: false,
        title: input.title, subtitle: input.subtitle ?? null, imageUrl: input.imageUrl, textInImage: input.textInImage,
        actionType: input.actionType, actionTarget: input.actionTarget ?? null,
      },
    });
    return created;
  });
  await logStep(deps.prisma, promo.id, input.launchAt ? `Ready; launches ${input.launchAt.toISOString()}` : "Ready to launch");
  if (input.launchNow) await launchPromo(deps, promo.id);
  return promo;
}

/**
 * Puts new art or wording on a promotion's banner. An AI promotion that hasn't launched keeps its art on its
 * collection (the banner is made at launch), so that is updated too.
 */
export async function updatePromoBanner(
  prisma: PrismaClient,
  promo: BannerOwner,
  input: { imageUrl?: string; textInImage?: boolean; title?: string; subtitle?: string | null },
) {
  if (!["READY", "LIVE"].includes(promo.status)) throw new PromoStateError("The banner can be changed while the promotion is ready or live");
  // New art replaces the per-language images too, so every language shows it
  const art = input.imageUrl ? { imageUrl: input.imageUrl, imageUrls: { en: input.imageUrl }, textInImage: input.textInImage ?? true } : {};
  await prisma.$transaction(async (tx) => {
    await tx.banner.updateMany({
      where: { promoId: promo.id },
      data: { textInImage: input.textInImage, ...art, title: input.title, subtitle: input.subtitle },
    });
    if (promo.collectionId && input.imageUrl) await tx.collection.update({ where: { id: promo.collectionId }, data: art });
  });
}

/** Paints a new image for a promotion's banner from its wording and target; uses one of the month's AI images */
export async function regeneratePromoImage(prisma: PrismaClient, promo: BannerOwner, log: FastifyBaseLogger) {
  if (!["READY", "LIVE"].includes(promo.status)) throw new PromoStateError("The banner can be changed while the promotion is ready or live");
  const banner = await prisma.banner.findFirst({ where: { promoId: promo.id }, select: { title: true, subtitle: true } });
  const en = copyOf(promo);
  const art = await generateBannerImage(prisma, promo.organizationId, {
    title: (banner?.title ?? en?.title ?? "Offer").slice(0, 40), subtitle: banner?.subtitle ?? en?.subtitle,
    actionType: promo.kind === "AI" ? "COLLECTION" : promo.actionType, actionTarget: promo.kind === "AI" ? promo.collectionId : promo.actionTarget,
  }, (m) => log.warn(`promo ${promo.id} image: ${m}`));
  await updatePromoBanner(prisma, promo, { imageUrl: art.imageUrl, textInImage: art.textInImage });
}
