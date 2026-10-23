import sharp from "sharp";
import type { BannerPlacement } from "../../../generated/prisma/client.js";
import { bannerSize, prepareBanner, uploadBanner, type BannerFormat } from "../seasonal/banner-art.js";
import { isMediaUrl } from "../media.js";
import { CampaignError } from "./booking-error.js";

// Posters are tall and a category takeover is the wide strip atop the category page; carousel banners are 3:2.
// Sponsored products and tab slots show a product photo or logo, so they have no creative shape.
const FORMATS: Partial<Record<BannerPlacement, BannerFormat>> = { HERO_CAROUSEL: "landscape", HOME_POSTER: "portrait", CATEGORY_TOP: "wide" };

export const creativeFormat = (placement: BannerPlacement | null) => (placement ? FORMATS[placement] : undefined);

/**
 * An uploaded creative saved at the size phones show it in its placement, so a poster isn't a 1024px download for a
 * 140pt rail. Art already at that size (painted by us) is kept as it is.
 */
export async function fitCreative(placement: BannerPlacement | null, imageUrl: string | null | undefined, slug: string) {
  const format = creativeFormat(placement);
  if (!imageUrl || !format) return imageUrl ?? null;
  // Only our own uploads are fetched, so a booking can't make the server request arbitrary URLs
  if (!isMediaUrl(imageUrl)) throw new CampaignError("Upload the creative through Martly");
  const res = await fetch(imageUrl);
  if (!res.ok) throw new CampaignError("The creative couldn't be read; upload it again");
  const image = Buffer.from(await res.arrayBuffer());
  const { width, height } = await sharp(image).metadata();
  const target = bannerSize(format);
  if (width === target.width && height === target.height) return imageUrl;
  return uploadBanner(await prepareBanner(image, format), slug, "upload");
}
