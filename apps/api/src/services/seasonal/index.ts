import { Prisma, type FestivalEvent, type PrismaClient } from "../../../generated/prisma/client.js";
import { orgSubcategoryCandidates, pickProducts } from "./candidates.js";
import { curateWithClaude } from "./curator.js";
import { buildBannerSet, type BannerLog, type BannerSet } from "./banner-set.js";
import { liveFrom, type CurationOrg } from "./due-events.js";

const MIN_PRODUCTS = 6;

export type CurationResult =
  | { status: "created"; collectionId: string; bannerId: string }
  | { status: "exists"; collectionId?: string }
  | { status: "skipped"; reason: string };

// Prisma needs DbNull rather than null to clear a Json column
export function bannerFields(art: BannerSet) {
  return { imageUrl: art.imageUrl, imageUrls: art.imageUrls ?? Prisma.DbNull, textInImage: art.textInImage };
}

export function isCurationConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.OPENAI_API_KEY);
}

/**
 * Builds an AGENT collection plus a hero banner for one org and event. Both are scheduled to go live at
 * the event's lead date, so admins get a review window where deactivating the collection is the veto.
 */
export async function curateEvent(prisma: PrismaClient, org: CurationOrg, event: FestivalEvent, log: BannerLog): Promise<CurationResult> {
  const existing = await prisma.collection.findFirst({ where: { organizationId: org.id, festivalEventId: event.id }, select: { id: true } });
  if (existing) return { status: "exists", collectionId: existing.id };

  const candidates = await orgSubcategoryCandidates(prisma, org.id);
  const curation = await curateWithClaude(event, candidates);
  if (curation.skip) return { status: "skipped", reason: curation.skipReason };

  const productIds = await pickProducts(prisma, org.id, curation.subcategoryIds);
  if (productIds.length < MIN_PRODUCTS) return { status: "skipped", reason: `Only ${productIds.length} in-stock products matched` };

  const slug = `${event.slug}-${org.slug}`;
  const art = bannerFields(await buildBannerSet(curation.imagePrompt, {
    en: { title: curation.title, subtitle: curation.subtitle },
    ta: { title: curation.titleTa, subtitle: curation.subtitleTa },
  }, slug, log));
  const window = { startsAt: liveFrom(event), endsAt: event.endsAt };
  try {
    return await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: {
          organizationId: org.id, festivalEventId: event.id, source: "AGENT", kind: event.kind, slug, ...art,
          artDirection: curation.imagePrompt, title: curation.title, subtitle: curation.subtitle, ...window,
          translations: { ta: { title: curation.titleTa, subtitle: curation.subtitleTa } },
          items: { create: productIds.map((productId, sortOrder) => ({ productId, sortOrder })) },
        },
      });
      const banner = await tx.banner.create({
        data: {
          organizationId: org.id, title: curation.title, subtitle: curation.subtitle, ...art, ...window,
          placement: "HERO_CAROUSEL", actionType: "COLLECTION", actionTarget: collection.id,
        },
      });
      return { status: "created" as const, collectionId: collection.id, bannerId: banner.id };
    });
  } catch (err) {
    // A concurrent run (another instance or a manual "Curate now") got there first
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { status: "exists" };
    throw err;
  }
}

type BannerSource = { id: string; slug: string; title: string; subtitle: string | null; translations: unknown; artDirection: string };

/** Redraws a collection's banner from its current copy, e.g. after an admin edits the title. */
export async function regenerateBanner(prisma: PrismaClient, collection: BannerSource, log: BannerLog) {
  const ta = (collection.translations as { ta?: { title?: string; subtitle?: string } } | null)?.ta;
  const copies: Record<string, { title: string; subtitle: string }> = { en: { title: collection.title, subtitle: collection.subtitle ?? "" } };
  if (ta?.title) copies.ta = { title: ta.title, subtitle: ta.subtitle ?? "" };
  const art = bannerFields(await buildBannerSet(collection.artDirection, copies, collection.slug, log));
  await prisma.$transaction([
    prisma.collection.update({ where: { id: collection.id }, data: art }),
    prisma.banner.updateMany({
      where: { actionType: "COLLECTION", actionTarget: collection.id },
      data: { ...art, title: collection.title, subtitle: collection.subtitle },
    }),
  ]);
  return art;
}

