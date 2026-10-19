import { randomUUID } from "crypto";
import OpenAI from "openai";
import type { Messaging } from "firebase-admin/messaging";
import { AI_IMAGE_COST } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildBannerSet, type BannerLog } from "../seasonal/banner-set.js";
import { chooseDesign } from "../seasonal/banner-design.js";
import { BannerArtError } from "../seasonal/banner-art.js";
import { withAiImages } from "./ai-images.js";
import { targetScene } from "./target-scene.js";

export interface BannerImageRequest {
  title: string;
  subtitle?: string | null;
  brief?: string | null;
  actionType?: string | null;
  actionTarget?: string | null;
}

/**
 * Paints a banner image with the copy set into it, in a layout and style the owner hasn't used lately. It takes one of
 * the organisation's AI images, given back if painting fails.
 */
export function generateBannerImage(
  ctx: { prisma: PrismaClient; fcm: Messaging | null }, organizationId: string | null, input: BannerImageRequest, log: BannerLog, refId: string | null = null,
) {
  return withAiImages(ctx, organizationId, AI_IMAGE_COST.PROMO_BANNER, "PROMO_BANNER", refId, () => paintBannerImage(ctx.prisma, organizationId, input, log));
}

async function paintBannerImage(prisma: PrismaClient, organizationId: string | null, input: BannerImageRequest, log: BannerLog) {
  const run = await prisma.$transaction(async (tx) => {
    const design = await chooseDesign(tx, { organizationId });
    return tx.bannerArtRun.create({ data: { ...design, organizationId, purpose: "BANNER" } });
  });
  try {
    const scene = input.brief?.trim()
      || (await targetScene(prisma, organizationId, input.actionType, input.actionTarget))
      || `Products and props that fit "${input.title}"${input.subtitle ? `, ${input.subtitle}` : ""}`;
    const art = await buildBannerSet(scene, { en: { title: input.title, subtitle: input.subtitle ?? "" } }, `banner-${randomUUID().slice(0, 8)}`, log, run);
    await prisma.bannerArtRun.update({ where: { id: run.id }, data: { imageUrl: art.imageUrl } });
    return art;
  } catch (err) {
    await prisma.bannerArtRun.delete({ where: { id: run.id } });
    if (err instanceof OpenAI.APIError || err instanceof BannerArtError) {
      log(`AI banner image failed: ${err.message}`);
      throw Object.assign(new Error("The AI image service is unavailable right now. Try again later or upload your own image."), { statusCode: 503 });
    }
    throw err;
  }
}
