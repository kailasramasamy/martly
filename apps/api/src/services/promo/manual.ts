import type { Messaging } from "firebase-admin/messaging";
import type { CreateManualPromoInput, PromoBannerInput } from "@martly/shared/schemas";
import type { Prisma, PrismaClient, Promo } from "../../../generated/prisma/client.js";
import { assertBannerSlot } from "../marketing/entitlements.js";
import { logStep, type PromoDeps } from "./draft.js";
import { launchPromo, PromoStateError } from "./lifecycle.js";
import { productsForTarget } from "./targets.js";

class PromoInputError extends Error {
  name = "PromoInputError";
  statusCode = 400;
}

type BannerOwner = Pick<Promo, "id" | "organizationId" | "kind" | "actionType" | "actionTarget" | "collectionId" | "copy" | "startsAt" | "endsAt" | "status">;

/** What a promotion's banners open: a manual one's target, an AI one's product collection */
function bannerAction(promo: BannerOwner) {
  if (promo.kind === "AI") return { actionType: "COLLECTION" as const, actionTarget: promo.collectionId };
  return { actionType: promo.actionType ?? "NONE", actionTarget: promo.actionTarget };
}

function bannerData(promo: BannerOwner, input: Partial<PromoBannerInput>) {
  const en = (promo.copy as { en?: { title?: string; subtitle?: string } } | null)?.en;
  return {
    placement: input.placement!, imageUrl: input.imageUrl!, textInImage: input.textInImage ?? true,
    title: input.title || en?.title || "Promotion", subtitle: input.subtitle ?? en?.subtitle ?? null,
    storeId: input.storeId ?? null, departmentId: input.departmentId ?? null, categoryId: input.categoryId ?? null,
    subcategoryId: input.subcategoryId ?? null, sortOrder: input.sortOrder ?? 0,
  };
}

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

/** Sets up a manual promotion with its banners as Ready; it goes live now, at launchAt, or when the owner launches it */
export async function createManualPromo(deps: PromoDeps & { fcm: Messaging | null }, input: CreateManualPromoInput, organizationId: string, createdById: string) {
  if (input.launchAt && input.launchAt <= new Date()) throw new PromoInputError("Pick a launch time in the future, or launch now");
  await checkDiscount(deps.prisma, organizationId, input);
  const copy = { en: { title: input.title, subtitle: input.subtitle ?? "" } };
  const promo = await deps.prisma.$transaction(async (tx) => {
    const created = await tx.promo.create({
      data: {
        organizationId, createdById, kind: "MANUAL", status: "READY", brief: input.title, copy, notify: input.notify,
        actionType: input.actionType, actionTarget: input.actionTarget ?? null, discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null, durationDays: input.durationDays, launchAt: input.launchAt ?? null,
      },
    });
    for (const banner of input.banners) {
      await tx.banner.create({ data: { ...bannerData(created, banner), ...bannerAction(created), organizationId, promoId: created.id, isActive: false } });
    }
    return created;
  });
  await logStep(deps.prisma, promo.id, input.launchAt ? `Ready; launches ${input.launchAt.toISOString()}` : "Ready to launch");
  if (input.launchNow) await launchPromo(deps, promo.id);
  return promo;
}

/** Adds a banner (another placement) to a promotion; on a live one it goes up straight away and needs a free slot */
export async function addPromoBanner(prisma: PrismaClient, promo: BannerOwner, input: PromoBannerInput) {
  if (["DISCARDED", "FAILED", "DRAFTING"].includes(promo.status)) throw new PromoStateError("Banners can be added to a ready, live or ended promotion");
  const live = promo.status === "LIVE";
  return prisma.$transaction(async (tx) => {
    if (live) await assertBannerSlot(tx, promo.organizationId);
    return tx.banner.create({
      data: {
        ...bannerData(promo, input), ...bannerAction(promo), organizationId: promo.organizationId, promoId: promo.id,
        isActive: live, startsAt: live ? promo.startsAt : null, endsAt: live ? promo.endsAt : null,
      },
    });
  });
}

/** Edits one of a promotion's banners; switching it on is only possible while the promotion is live */
export async function updatePromoBanner(prisma: PrismaClient, promo: BannerOwner, bannerId: string, input: Partial<PromoBannerInput> & { isActive?: boolean }) {
  return prisma.$transaction(async (tx) => {
    const banner = await tx.banner.findFirst({ where: { id: bannerId, promoId: promo.id } });
    if (!banner) throw Object.assign(new Error("Banner not found"), { statusCode: 404 });
    const turningOn = input.isActive === true && !banner.isActive;
    if (turningOn && promo.status !== "LIVE") throw new PromoStateError("Banners go live with the promotion; launch it first");
    if (turningOn && !banner.slotFree) await assertBannerSlot(tx, promo.organizationId);
    const { isActive, title, ...fields } = input;
    // A cleared title falls back to the promotion's, as on create
    const data: Prisma.BannerUncheckedUpdateInput = {
      ...fields, ...(title === undefined ? {} : { title: title || bannerData(promo, {}).title }), ...(isActive === undefined ? {} : { isActive }),
    };
    return tx.banner.update({ where: { id: bannerId }, data });
  });
}

export async function removePromoBanner(prisma: PrismaClient, promo: BannerOwner, bannerId: string) {
  const { count } = await prisma.banner.deleteMany({ where: { id: bannerId, promoId: promo.id } });
  if (!count) throw Object.assign(new Error("Banner not found"), { statusCode: 404 });
}
