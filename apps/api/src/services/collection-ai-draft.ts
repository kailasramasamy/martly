import type { PrismaClient } from "../../generated/prisma/client.js";
import type { EDITABLE_COLLECTION_KINDS } from "@martly/shared/constants";
import { orgSubcategoryCandidates, pickProducts } from "./seasonal/candidates.js";
import { curate, CurationRefusedError, describeBrief } from "./seasonal/curator.js";
import { slugify } from "./brands.js";
import { firstFreeSlug } from "./onboarding/owner.js";

export type CollectionDraft = Awaited<ReturnType<typeof draftFromCuration>>;

async function draftFromCuration(prisma: PrismaClient, orgId: string, curation: Awaited<ReturnType<typeof curate>>, storeSpecial: boolean) {
  const ids = await pickProducts(prisma, orgId, curation.subcategoryIds, storeSpecial);
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, imageUrl: true, subcategory: { select: { name: true } } },
  });
  const products = ids.flatMap((id) => rows.filter((r) => r.id === id))
    .map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, subcategory: p.subcategory?.name ?? null }));
  // Slugs are unique across all organizations, so the draft carries one nobody has taken
  const base = slugify(curation.title) || "collection";
  const taken = await prisma.collection.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  return {
    title: curation.title, subtitle: curation.subtitle, titleTa: curation.titleTa, subtitleTa: curation.subtitleTa,
    slug: firstFreeSlug(base, taken.map((c) => c.slug)), artDirection: curation.imagePrompt, organizationId: orgId, products,
  };
}

/** The AI curator's draft of a collection from a brief, drawn from what the organization's stores stock; a string says why there is none */
export async function draftCollection(
  prisma: PrismaClient, orgId: string, brief: string, kind: (typeof EDITABLE_COLLECTION_KINDS)[number],
): Promise<CollectionDraft | string> {
  const curation = await curate(describeBrief(brief, kind), await orgSubcategoryCandidates(prisma, orgId)).catch((err: unknown) => {
    if (err instanceof CurationRefusedError) return null;
    throw err;
  });
  if (!curation) return "The AI couldn't draft this brief; try rewording it";
  if (curation.skip) return curation.skipReason || "The stores don't stock enough for this brief";
  return draftFromCuration(prisma, orgId, curation, kind === "STORE_SPECIAL");
}
