import Anthropic from "@anthropic-ai/sdk";
import type { Messaging } from "firebase-admin/messaging";
import type { DiscountType, Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { BannerArtError } from "../seasonal/banner-art.js";
import { failPromo, logStep, PromoFailure, runDraft, type PromoDeps } from "./draft.js";
import { JudgeRefusedError } from "./judge.js";
import { applyChanges, restoreChanges } from "./pricing.js";
import { sendPromoPush } from "./push.js";
import { MIN_PRODUCTS } from "./tools.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export class PromoStateError extends Error {
  statusCode = 409;
}

function failureReason(err: unknown) {
  if (err instanceof PromoFailure) return err.message;
  if (err instanceof BannerArtError) return "The banner artwork couldn't be generated; try again";
  if (err instanceof JudgeRefusedError) return "The relevance check didn't answer; try again";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy; try again in a minute";
  if (err instanceof Anthropic.APIError) return `The AI service failed (${err.status ?? "network"}); try again`;
  return null;
}

/** Creates the promo and drafts it in the background; the admin polls GET /promos/:id for progress. */
export async function startPromoDraft(
  deps: PromoDeps & { fcm: Messaging | null },
  input: { organizationId: string; createdById: string; brief: string; autoLaunch: boolean; notify: boolean },
) {
  const promo = await deps.prisma.promo.create({ data: input });
  runDraft(deps, promo)
    .then(() => (promo.autoLaunch ? launchPromo(deps, promo.id) : undefined))
    .catch(async (err: unknown) => {
      const reason = failureReason(err);
      // Unexpected errors still end the job: a background draft has no caller to rethrow to
      if (!reason) deps.log.error(err, `Promo ${promo.id} draft failed`);
      await failPromo(deps.prisma, promo.id, reason ?? "Something went wrong while drafting; try again");
    });
  return promo;
}

const offerOf = (promo: { discountType: DiscountType | null; discountValue: Prisma.Decimal | null }) =>
  promo.discountType && promo.discountValue ? { type: promo.discountType, value: Number(promo.discountValue) } : null;

/** Goes live in one transaction: discounts, home banner and collection, so a failure leaves nothing half-launched. */
export async function launchPromo(deps: PromoDeps & { fcm: Messaging | null }, promoId: string) {
  const startsAt = new Date();
  const promo = await deps.prisma.$transaction(async (tx) => {
    const current = await tx.promo.findUniqueOrThrow({ where: { id: promoId }, include: { collection: { include: { items: true } } } });
    if (current.status !== "READY" || !current.collection) throw new PromoStateError("Only a ready promo can be launched");
    const endsAt = new Date(startsAt.getTime() + current.durationDays * DAY_MS);
    const c = current.collection;
    const banner = await tx.banner.create({
      data: {
        organizationId: current.organizationId, title: c.title, subtitle: c.subtitle, placement: "HERO_CAROUSEL",
        imageUrl: c.imageUrl ?? "", imageUrls: c.imageUrls ?? undefined, textInImage: c.textInImage,
        actionType: "COLLECTION", actionTarget: c.id, sortOrder: 0, startsAt, endsAt,
      },
    });
    await tx.collection.update({ where: { id: c.id }, data: { isActive: true, startsAt, endsAt } });
    const offer = offerOf(current);
    const stats = offer
      ? await applyChanges(tx, promoId, { ...offer, organizationId: current.organizationId, productIds: c.items.map((i) => i.productId), startsAt, endsAt })
      : null;
    const claimed = await tx.promo.updateMany({ where: { id: promoId, status: "READY" }, data: { status: "LIVE", startsAt, endsAt, bannerId: banner.id } });
    if (claimed.count === 0) throw new PromoStateError("This promo was launched or discarded meanwhile");
    return { ...current, imageUrl: c.imageUrl, stats };
  });
  const s = promo.stats;
  await logStep(deps.prisma, promoId, s ? `Live: discount on ${s.listings} listings across ${s.stores} stores (${s.keptExisting} kept a bigger discount)` : "Live");
  if (!promo.notify) return;
  // The promo is already live; a failed push is reported on it rather than undoing the launch
  await sendPromoPush(deps.prisma, deps.fcm, promo, promo.imageUrl).catch(async (err: unknown) => {
    deps.log.error(err, `Promo ${promoId} push failed`);
    await logStep(deps.prisma, promoId, "The push notification couldn't be sent");
  });
}

/** Takes a live promo down: restores the discounts it overwrote and hides its banner and collection. */
export async function endPromo(prisma: PrismaClient, promoId: string, early: boolean) {
  const endedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const promo = await tx.promo.findUniqueOrThrow({ where: { id: promoId } });
    const claimed = await tx.promo.updateMany({
      where: { id: promoId, status: "LIVE" },
      data: { status: "ENDED", ...(early ? { endsAt: endedAt } : {}) },
    });
    if (claimed.count === 0) throw new PromoStateError("Only a live promo can be ended");
    const offer = offerOf(promo);
    if (offer && promo.startsAt && promo.endsAt) await restoreChanges(tx, promoId, { ...offer, startsAt: promo.startsAt, endsAt: promo.endsAt });
    if (promo.bannerId) await tx.banner.update({ where: { id: promo.bannerId }, data: { isActive: false } });
    if (promo.collectionId) await tx.collection.update({ where: { id: promo.collectionId }, data: { isActive: false } });
  });
  await logStep(prisma, promoId, early ? "Ended early; prices restored" : "Ended; prices restored");
}

export async function discardPromo(prisma: PrismaClient, promoId: string) {
  const claimed = await prisma.promo.updateMany({ where: { id: promoId, status: { in: ["READY", "FAILED"] } }, data: { status: "DISCARDED" } });
  if (claimed.count === 0) throw new PromoStateError("Only a ready or failed promo can be discarded");
}

/** Puts an ended promo back to READY with the same art and products, so it can be launched for a fresh window. */
export async function reopenPromo(prisma: PrismaClient, promoId: string) {
  await prisma.$transaction(async (tx) => {
    const promo = await tx.promo.findUniqueOrThrow({ where: { id: promoId }, select: { bannerId: true } });
    const claimed = await tx.promo.updateMany({
      where: { id: promoId, status: "ENDED" },
      data: { status: "READY", startsAt: null, endsAt: null, bannerId: null },
    });
    if (claimed.count === 0) throw new PromoStateError("Only an ended promo can be used again");
    // The last run's prices are already restored and its banner is off; the next launch makes fresh ones
    await tx.promoPriceChange.deleteMany({ where: { promoId } });
    if (promo.bannerId) await tx.banner.delete({ where: { id: promo.bannerId } });
  });
  await logStep(prisma, promoId, "Reopened for another run");
}

/** Keeps only the given products (in their current order) before launch. */
export async function keepPromoItems(prisma: PrismaClient, promoId: string, productIds: string[]) {
  const promo = await prisma.promo.findUniqueOrThrow({ where: { id: promoId }, select: { status: true, collectionId: true } });
  if (promo.status !== "READY" || !promo.collectionId) throw new PromoStateError("Products can only be changed before launch");
  const keep = new Set(productIds);
  const items = await prisma.collectionItem.findMany({ where: { collectionId: promo.collectionId }, select: { productId: true } });
  const remaining = items.filter((i) => keep.has(i.productId)).length;
  if (remaining < MIN_PRODUCTS) throw Object.assign(new Error(`A promo needs at least ${MIN_PRODUCTS} products`), { statusCode: 400 });
  await prisma.collectionItem.deleteMany({ where: { collectionId: promo.collectionId, productId: { notIn: productIds } } });
}
