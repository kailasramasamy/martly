import type { FastifyBaseLogger } from "fastify";
import type { BrandCampaign, PrismaClient } from "../../../generated/prisma/client.js";
import { buildDesignedBannerSet } from "../seasonal/banner-set.js";
import { CampaignError } from "./booking.js";

const DAILY_LIMIT = 6;

/** Paints the campaign's banner from its brief and copy, in a layout the brand hasn't used lately; posters are tall */
export async function generateCampaignArt(prisma: PrismaClient, campaign: BrandCampaign, log: FastifyBaseLogger) {
  if (!["DRAFT", "PENDING_PAYMENT", "IN_REVIEW"].includes(campaign.status)) throw new CampaignError("The banner can't change once the campaign is scheduled", 409);
  if (campaign.placement === "SPONSORED_PRODUCT") throw new CampaignError("A sponsored product shows its own product photo; there's no banner to paint");
  const today = await prisma.bannerArtRun.count({
    where: { brandId: campaign.brandId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (today >= DAILY_LIMIT) throw new CampaignError(`Up to ${DAILY_LIMIT} AI banners a day per brand; try again tomorrow or upload one`, 429);
  const scene = campaign.brief?.trim() || `Products and props that fit "${campaign.title}"`;
  const slug = `brand-${campaign.id.slice(0, 8)}`;
  const art = await buildDesignedBannerSet(prisma, { brandId: campaign.brandId, purpose: "BRAND" }, scene,
    { en: { title: campaign.title, subtitle: campaign.subtitle ?? "" } }, slug, (m) => log.warn(`${slug}: ${m}`),
    campaign.placement === "HOME_POSTER" ? "portrait" : "landscape");
  return prisma.brandCampaign.update({ where: { id: campaign.id }, data: { imageUrl: art.imageUrl } });
}
