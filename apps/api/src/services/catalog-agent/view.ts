import type { CatalogDraftDetail, CatalogDraftShot, CatalogDraftSummary } from "@martly/shared/types";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { ProcessedShot } from "./images.js";
import type { Proposal } from "./publish.js";
import type { UsageEntry } from "./usage.js";

export const draftInclude = {
  store: { select: { name: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.CatalogDraftInclude;

type DraftRow = Prisma.CatalogDraftGetPayload<{ include: typeof draftInclude }>;

const proposalOf = (row: DraftRow) => row.extracted as unknown as Proposal | null;
const shotsOf = (row: DraftRow) => row.processedImages as unknown as ProcessedShot[];
const usageOf = (row: DraftRow) => row.usage as unknown as UsageEntry[];

export function toSummary(row: DraftRow): CatalogDraftSummary {
  const label = proposalOf(row)?.label;
  const front = shotsOf(row).sort((a, b) => a.index - b.index)[0];
  return {
    id: row.id,
    status: row.status,
    storeId: row.storeId,
    storeName: row.store.name,
    name: label?.name ?? row.hintName,
    variantName: label?.variantName ?? null,
    thumbnailUrl: front?.url ?? row.photos[0],
    photoCount: row.photos.length,
    mrp: Number(row.mrp),
    sellingPrice: Number(row.sellingPrice),
    stock: row.stock,
    reviewReasons: row.reviewReasons,
    error: row.error,
    productId: row.productId,
    matchedExisting: row.matchedExisting,
    createdByName: row.createdBy.name,
    costUsd: Math.round(usageOf(row).reduce((sum, u) => sum + u.usd, 0) * 10000) / 10000,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toDetail(row: DraftRow): CatalogDraftDetail {
  const proposal = proposalOf(row);
  const processed = shotsOf(row);
  const c = proposal?.classification;
  const shots: CatalogDraftShot[] = row.photos.map((original, index) => {
    const done = processed.find((s) => s.index === index);
    return {
      index,
      original,
      processed: done?.url ?? null,
      source: done?.source ?? null,
      verdict: done?.verdict ?? null,
      differences: done?.differences ?? [],
      role: proposal?.label.shots.find((s) => s.index === index)?.role ?? null,
    };
  });
  return {
    ...toSummary(row),
    hintName: row.hintName,
    shots,
    label: proposal?.label ?? null,
    brand: c?.brand ?? null,
    brandConfidence: c?.brandConfidence ?? null,
    subcategory: c?.subcategoryId && c.subcategoryPath ? { id: c.subcategoryId, path: c.subcategoryPath } : null,
    subcategoryConfidence: c?.subcategoryConfidence ?? null,
    barcodeTaken: proposal?.barcodeTaken ?? false,
    usage: usageOf(row),
  };
}
