import type { BannerArtPurpose, Prisma, PrismaClient } from "../../../generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;

/** Where the copy goes and how the picture is arranged around it; each reads very differently at a glance */
const LAYOUTS: Record<string, { composition: string; text: string }> = {
  "headline-top": {
    composition: "The products are arranged in a lively, slightly overlapping row along the bottom half.",
    text: "Centred across the top 40%; the headline spans about 80% of the banner width.",
  },
  "center-stage": {
    composition: "Products frame the banner from the left and right edges, leaving the centre clean.",
    text: "Centred in the middle; the headline spans about 70% of the banner width.",
  },
  "right-panel": {
    composition: "The scene fills the left 55%; the right 45% is a solid, bold colour panel with a soft curved edge.",
    text: "On the right colour panel, left-aligned within it; the headline fills the panel's width.",
  },
  "colour-block-left": {
    composition: "A solid, bold colour block covers the left 45% with a clean diagonal edge; the scene fills the rest.",
    text: "On the left colour block; the headline fills the block's width.",
  },
  "poster": {
    composition: "One large hero product on a flat, vivid background colour, overlapping the bottom of the headline letters.",
    text: "A giant headline across the middle filling about 85% of the width, poster style.",
  },
  "flat-lay-frame": {
    composition: "Overhead flat-lay with the products around all four edges, leaving a clear area in the middle.",
    text: "Centred in the clear middle area; the headline spans about 60% of the width.",
  },
  "diagonal-band": {
    composition: "A bold diagonal colour band runs from bottom-left to top-right; products burst out above and below it.",
    text: "Along the diagonal band, rotated to follow it slightly; the headline runs most of the band's length.",
  },
  "bottom-band": {
    composition: "The scene fills the top 60%; a solid colour band spans the full width of the bottom 40%.",
    text: "On the bottom band: headline left-aligned across about 65% of the width, button on the right.",
  },
};

const STYLES: Record<string, string> = {
  "studio-colour": "bright studio photography on a vivid, single-colour seamless backdrop with crisp shadows",
  "overhead-natural": "overhead natural-light photography on a textured surface (wood, linen or stone)",
  "3d-render": "glossy, playful 3D render with soft shadows and rounded shapes",
  "flat-vector": "bold flat vector illustration with thick shapes and a limited palette",
  "paper-collage": "paper-cut collage with layered, tactile textures",
  "festive-indian": "warm festive Indian look with kolam or rangoli motifs and marigold accents in the background",
  "pastel-minimal": "minimal pastel design with generous clean space and soft gradients",
  "moody-dark": "dramatic dark food photography with rich, directional light",
};

export interface BannerDesign {
  layout: string;
  style: string;
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** A layout and style the organisation hasn't used in its last few banners, so consecutive banners look distinct */
export async function chooseDesign(prisma: Db, owner: { organizationId?: string | null; brandId?: string | null }) {
  const recent = await prisma.bannerArtRun.findMany({
    where: owner.brandId ? { brandId: owner.brandId } : { organizationId: owner.organizationId ?? null },
    orderBy: { createdAt: "desc" }, take: 5, select: { layout: true, style: true },
  });
  const usedLayouts = new Set(recent.slice(0, 4).map((r) => r.layout));
  const usedStyles = new Set(recent.slice(0, 3).map((r) => r.style));
  return {
    layout: pick(Object.keys(LAYOUTS).filter((l) => !usedLayouts.has(l))),
    style: pick(Object.keys(STYLES).filter((s) => !usedStyles.has(s))),
  };
}

export function recordDesign(
  prisma: PrismaClient,
  run: BannerDesign & { purpose: BannerArtPurpose; organizationId?: string | null; brandId?: string | null; imageUrl?: string | null },
) {
  return prisma.bannerArtRun.create({ data: run });
}

/** The art-direction part of the image prompt for a design */
export function designBrief(design: BannerDesign) {
  const layout = LAYOUTS[design.layout] ?? LAYOUTS["center-stage"];
  return {
    style: STYLES[design.style] ?? STYLES["studio-colour"],
    composition: layout.composition,
    textPlacement: layout.text,
  };
}
