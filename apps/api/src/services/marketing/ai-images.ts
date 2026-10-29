import type { AiImagePurpose } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { getEntitlements, PaymentRequiredError } from "./entitlements.js";

/** The organisation reached the month's hidden banner cap; owners are pointed to the Martly team */
export class AiImagesExhaustedError extends PaymentRequiredError {
  name = "AI_IMAGES_EXHAUSTED";
}

export interface AiImageCharge {
  organizationId: string;
  purpose: AiImagePurpose;
  refId: string | null;
  count: number;
}

/**
 * Takes `count` banners from the month's hidden cap before painting. A per-org lock keeps two requests from
 * spending the same room. A null organisation (Martly's own team) is never counted.
 */
export async function chargeAiImages(
  prisma: PrismaClient, organizationId: string | null, count: number, purpose: AiImagePurpose, refId: string | null = null,
): Promise<AiImageCharge | null> {
  if (!organizationId || count <= 0) return null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-images:${organizationId}`}))`;
    const { aiImages } = await getEntitlements(tx, organizationId);
    if (aiImages.left < count) throw new AiImagesExhaustedError("You've made a lot of banners this month. Ask Martly to help.");
    await tx.aiImageCreditEntry.create({ data: { organizationId, reason: "USED", purpose, refId, delta: -count, fromPlan: true } });
    return { organizationId, purpose, refId, count };
  });
}

/** Gives back `count` banners of a charge that weren't painted */
export async function refundAiImages(prisma: PrismaClient, charge: AiImageCharge | null, count = Infinity) {
  const back = Math.min(charge?.count ?? 0, count);
  if (!charge || back <= 0) return;
  await prisma.aiImageCreditEntry.create({
    data: { organizationId: charge.organizationId, reason: "REFUND", purpose: charge.purpose, refId: charge.refId, delta: back, fromPlan: true },
  });
}

/** Runs a paint with its banners counted first, giving them all back if it throws */
export async function withAiImages<T>(
  ctx: { prisma: PrismaClient }, organizationId: string | null, count: number, purpose: AiImagePurpose,
  refId: string | null, paint: (charge: AiImageCharge | null) => Promise<T>,
) {
  const charge = await chargeAiImages(ctx.prisma, organizationId, count, purpose, refId);
  try {
    return await paint(charge);
  } catch (err) {
    await refundAiImages(ctx.prisma, charge);
    throw err;
  }
}
