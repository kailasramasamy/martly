import { randomUUID } from "crypto";
import OpenAI from "openai";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildBannerSet, type BannerLog } from "../seasonal/banner-set.js";
import { chooseDesign } from "../seasonal/banner-design.js";
import { BannerArtError } from "../seasonal/banner-art.js";
import { getEntitlements, PaymentRequiredError } from "./entitlements.js";

export interface BannerImageRequest {
  title: string;
  subtitle?: string | null;
  brief?: string | null;
}

/**
 * Paints a banner image with the copy set into it, in a layout and style the owner hasn't used lately. An
 * organisation's run is reserved against its monthly AI-image allowance first and released if painting fails.
 */
export async function generateBannerImage(prisma: PrismaClient, organizationId: string | null, input: BannerImageRequest, log: BannerLog) {
  const run = await prisma.$transaction(async (tx) => {
    if (organizationId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-images:${organizationId}`}))`;
      const { aiImages } = await getEntitlements(tx, organizationId);
      if (aiImages.used >= aiImages.total) {
        throw new PaymentRequiredError(`You've used this month's ${aiImages.total} AI images. Upload your own image or upgrade your plan.`);
      }
    }
    const design = await chooseDesign(tx, { organizationId });
    return tx.bannerArtRun.create({ data: { ...design, organizationId, purpose: "BANNER" } });
  });
  try {
    const scene = input.brief?.trim() || `Products and props that fit "${input.title}"${input.subtitle ? `, ${input.subtitle}` : ""}`;
    const art = await buildBannerSet(scene, { en: { title: input.title, subtitle: input.subtitle ?? "" } }, `banner-${randomUUID().slice(0, 8)}`, log, run);
    await prisma.bannerArtRun.update({ where: { id: run.id }, data: { imageUrl: art.imageUrl } });
    return art;
  } catch (err) {
    await prisma.bannerArtRun.delete({ where: { id: run.id } });
    if (err instanceof OpenAI.APIError || err instanceof BannerArtError) {
      throw Object.assign(new Error("The AI image service is unavailable right now. Try again later or upload your own image."), { statusCode: 503 });
    }
    throw err;
  }
}
