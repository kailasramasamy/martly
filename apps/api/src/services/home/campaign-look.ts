import type { HomeTheme } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";

const PALETTE: HomeTheme[] = [
  { background: "#fdf2f8", title: "#831843", dark: false },
  { background: "#ecfdf5", title: "#065f46", dark: false },
  { background: "#fffbeb", title: "#78350f", dark: false },
  { background: "#eff6ff", title: "#1e3a8a", dark: false },
  { background: "#f5f3ff", title: "#4c1d95", dark: false },
];

/** Stable per collection, so a promotion keeps its colours between visits and on its own screen */
export function defaultTheme(collectionId: string): HomeTheme {
  const hash = [...collectionId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

export function promoOfferLabel(promo: { discountType: string | null; discountValue: unknown } | null) {
  const value = Number(promo?.discountValue ?? 0);
  if (!promo?.discountType || value <= 0) return null;
  return promo.discountType === "PERCENTAGE" ? `Flat ${value}% OFF` : `Flat ₹${value} OFF`;
}

export interface CampaignLook {
  imageUrl: string | null;
  theme: HomeTheme;
  offerLabel: string | null;
}

type LookCollection = { id: string; kind: string; imageUrl: string | null; promo: { discountType: string | null; discountValue: unknown } | null };

/**
 * How a collection presents itself as a campaign in an organisation: its Home campaign card's art, colours and offer,
 * or a live promo's defaults; null when it isn't a campaign there. Its own screen uses this to match the card.
 */
export async function campaignLook(prisma: PrismaClient, organizationId: string, collection: LookCollection): Promise<CampaignLook | null> {
  const card = await prisma.homeSection.findFirst({
    where: { organizationId, type: "CAMPAIGN_CARD", collectionId: collection.id, isActive: true },
    select: { config: true },
  });
  if (card) {
    const config = card.config as { imageUrl?: string; theme?: HomeTheme; offerLabel?: string };
    return {
      imageUrl: config.imageUrl ?? collection.imageUrl,
      theme: config.theme ?? defaultTheme(collection.id),
      offerLabel: config.offerLabel ?? null,
    };
  }
  if (collection.kind !== "PROMO") return null;
  return { imageUrl: collection.imageUrl, theme: defaultTheme(collection.id), offerLabel: promoOfferLabel(collection.promo) };
}
