import type { Messaging } from "firebase-admin/messaging";
import type { AiImagePurpose } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { alertOnce } from "../notify/once.js";
import { getEntitlements, PaymentRequiredError } from "./entitlements.js";
import { notifyOwners } from "./renewals.js";

// Owners hear once a month when this share of the plan's images is gone
const NUDGE_SHARE = 0.8;

/** Not enough AI images left for what was asked; the app offers an image pack */
export class AiImagesExhaustedError extends PaymentRequiredError {
  name = "AI_IMAGES_EXHAUSTED";
}

export interface AiImageCharge {
  organizationId: string;
  purpose: AiImagePurpose;
  refId: string | null;
  fromPlan: number;
  fromPacks: number;
}

/**
 * Takes `count` AI images before painting: the plan's month first, then packs. A per-org lock keeps two requests
 * from spending the same images. A null organisation (Martly's own team) is never charged.
 */
export async function chargeAiImages(
  prisma: PrismaClient, organizationId: string | null, count: number, purpose: AiImagePurpose, refId: string | null = null,
): Promise<AiImageCharge | null> {
  if (!organizationId || count <= 0) return null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-images:${organizationId}`}))`;
    const { aiImages } = await getEntitlements(tx, organizationId);
    if (aiImages.left < count) {
      throw new AiImagesExhaustedError(aiImages.left === 0
        ? "You've used all your AI images. Buy an image pack or upgrade your plan."
        : `This needs ${count} AI images and you have ${aiImages.left} left. Buy an image pack or upgrade your plan.`);
    }
    const fromPlan = Math.min(aiImages.planLeft, count);
    const fromPacks = count - fromPlan;
    const entry = { organizationId, reason: "USED" as const, purpose, refId };
    if (fromPlan) await tx.aiImageCreditEntry.create({ data: { ...entry, delta: -fromPlan, fromPlan: true } });
    if (fromPacks) await tx.aiImageCreditEntry.create({ data: { ...entry, delta: -fromPacks, fromPlan: false } });
    return { organizationId, purpose, refId, fromPlan, fromPacks };
  });
}

/** Gives back `count` images of a charge that weren't painted, pack images first since they never expire */
export async function refundAiImages(prisma: PrismaClient, charge: AiImageCharge | null, count = Infinity) {
  if (!charge) return;
  const toPacks = Math.min(charge.fromPacks, count);
  const toPlan = Math.min(charge.fromPlan, count - toPacks);
  const entry = { organizationId: charge.organizationId, reason: "REFUND" as const, purpose: charge.purpose, refId: charge.refId };
  await prisma.$transaction([
    ...(toPacks ? [prisma.aiImageCreditEntry.create({ data: { ...entry, delta: toPacks, fromPlan: false } })] : []),
    ...(toPlan ? [prisma.aiImageCreditEntry.create({ data: { ...entry, delta: toPlan, fromPlan: true } })] : []),
  ]);
}

/**
 * Runs a paint with its images charged first, giving them all back if it throws; afterwards the owners hear if
 * the month's images are running low.
 */
export async function withAiImages<T>(
  ctx: { prisma: PrismaClient; fcm: Messaging | null }, organizationId: string | null, count: number, purpose: AiImagePurpose,
  refId: string | null, paint: (charge: AiImageCharge | null) => Promise<T>,
) {
  const charge = await chargeAiImages(ctx.prisma, organizationId, count, purpose, refId);
  let result: T;
  try {
    result = await paint(charge);
  } catch (err) {
    await refundAiImages(ctx.prisma, charge);
    throw err;
  }
  // The images are painted and paid for; a failed nudge must not fail the request
  if (charge) void nudgeIfLow(ctx.fcm, ctx.prisma, charge.organizationId).catch((err: unknown) => console.error("AI image nudge failed", err));
  return result;
}

/** Once a month, tells the owners when most of the plan's images are gone, so they can top up before running out */
export async function nudgeIfLow(fcm: Messaging | null, prisma: PrismaClient, organizationId: string) {
  const { aiImages } = await getEntitlements(prisma, organizationId);
  if (aiImages.total === 0 || aiImages.used < aiImages.total * NUDGE_SHARE) return;
  const key = `ai-images-low:${organizationId}:${aiImages.resetsAt.toISOString().slice(0, 10)}`;
  if (!(await alertOnce(prisma, key))) return;
  await notifyOwners(fcm, prisma, organizationId, "Running low on AI images",
    `You've used ${aiImages.used} of this month's ${aiImages.total} AI images. Buy an image pack so banners and tiles keep coming.`);
}
