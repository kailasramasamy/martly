import type { HomeTheme } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { contrast, fromHsl, hex, rgb, toHsl } from "../color.js";

const PALETTE: HomeTheme[] = [
  { background: "#fdf2f8", title: "#831843", dark: false },
  { background: "#ecfdf5", title: "#065f46", dark: false },
  { background: "#fffbeb", title: "#78350f", dark: false },
  { background: "#eff6ff", title: "#1e3a8a", dark: false },
  { background: "#f5f3ff", title: "#4c1d95", dark: false },
];

// A store's own range wears the bakery-warm colours of its spotlight card, on Home and in search
const STORE_SPECIAL_THEME: HomeTheme = { background: "#fdebd3", title: "#7c3a0a", dark: false };

/** Stable per collection, so a promotion keeps its colours between visits and on its own screen */
export function defaultTheme(collectionId: string): HomeTheme {
  const hash = [...collectionId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

// A themed row's headline ink: its tint's hue, deepened until it reads as display text on that tint
const INK_CONTRAST = 7;
const INK_START = 0.3;
const INK_STEP = 0.02;

function rowTheme(tint: string): HomeTheme | null {
  const background = rgb(tint);
  if (!background) return null;
  const [h, sat] = toHsl(background);
  let l = INK_START;
  while (l > 0 && contrast(background, fromHsl([h, sat, l])) < INK_CONTRAST) l -= INK_STEP;
  return { background: tint, title: hex(fromHsl([h, sat, Math.max(l, 0)])), dark: false };
}

export function promoOfferLabel(promo: { discountType: string | null; discountValue: unknown } | null) {
  const value = Number(promo?.discountValue ?? 0);
  if (!promo?.discountType || value <= 0) return null;
  return promo.discountType === "PERCENTAGE" ? `Flat ${value}% OFF` : `Flat ₹${value} OFF`;
}

export interface CampaignLook {
  imageUrl: string | null;
  /** The art is a full photo (a store special's banner) rather than a cut-out, so it runs edge to edge */
  photo: boolean;
  theme: HomeTheme;
  offerLabel: string | null;
}

type LookCollection = { id: string; kind: string; imageUrl: string | null; promo: { discountType: string | null; discountValue: unknown } | null };

/**
 * How a collection presents itself in an organisation: its Home campaign card's art, colours and offer, else the
 * tint and art of a themed Home row, else a live promo's or store special's defaults; null when Home gives it no look.
 * Its own screen uses this to match what was tapped.
 */
export async function campaignLook(prisma: PrismaClient, organizationId: string, collection: LookCollection): Promise<CampaignLook | null> {
  const sections = await prisma.homeSection.findMany({
    where: { organizationId, type: { in: ["CAMPAIGN_CARD", "PRODUCT_ROW"] }, collectionId: collection.id, isActive: true },
    select: { type: true, config: true },
  });
  const card = sections.find((s) => s.type === "CAMPAIGN_CARD");
  if (card) {
    const config = card.config as { imageUrl?: string; theme?: HomeTheme; offerLabel?: string };
    return {
      imageUrl: config.imageUrl ?? collection.imageUrl,
      theme: config.theme ?? defaultTheme(collection.id),
      offerLabel: config.offerLabel ?? null,
      photo: false,
    };
  }
  const row = sections
    .map((s) => s.config as { headerStyle?: string; headerImageUrl?: string; tint?: string })
    .find((c) => c.tint && c.headerStyle !== "PLAIN");
  const theme = row?.tint ? rowTheme(row.tint) : null;
  if (row && theme) return { imageUrl: row.headerImageUrl ?? null, photo: false, theme, offerLabel: promoOfferLabel(collection.promo) };
  if (collection.kind === "STORE_SPECIAL") return { imageUrl: collection.imageUrl, photo: true, theme: STORE_SPECIAL_THEME, offerLabel: null };
  if (collection.kind !== "PROMO") return null;
  return { imageUrl: collection.imageUrl, photo: false, theme: defaultTheme(collection.id), offerLabel: promoOfferLabel(collection.promo) };
}
