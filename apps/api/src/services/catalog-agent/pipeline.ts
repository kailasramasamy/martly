import type { PrismaClient } from "../../../generated/prisma/client.js";
import { readLabel } from "./extract.js";
import { processShot, type ProcessedShot } from "./images.js";
import { brandCandidates, classify, findByBarcode } from "./match.js";
import { fetchPhoto } from "./photos.js";
import { listExisting, publishNew, type DraftForPublish, type Proposal } from "./publish.js";
import type { UsageEntry } from "./usage.js";
import { translateNewProduct, type ErrorLog } from "../translate/product.js";

// Shots rendered at once for one draft; the worker runs two drafts side by side
const SHOT_CONCURRENCY = 4;

type Draft = NonNullable<Awaited<ReturnType<typeof loadDraft>>>;

function loadDraft(prisma: PrismaClient, id: string) {
  return prisma.catalogDraft.findUnique({ where: { id } });
}

function appendUsage(prisma: PrismaClient, id: string, entries: UsageEntry[]) {
  return prisma.$executeRaw`UPDATE catalog_drafts SET usage = usage || ${JSON.stringify(entries)}::jsonb, updated_at = now() AT TIME ZONE 'UTC' WHERE id = ${id}`;
}

function appendShot(prisma: PrismaClient, id: string, shot: ProcessedShot) {
  return prisma.$executeRaw`UPDATE catalog_drafts SET processed_images = processed_images || ${JSON.stringify([shot])}::jsonb, updated_at = now() AT TIME ZONE 'UTC' WHERE id = ${id}`;
}

/** Reads the label and files the product; saved on the draft so a requeued job skips straight to the photos */
async function propose(prisma: PrismaClient, draft: Draft, photos: Buffer[]): Promise<Proposal> {
  if (draft.extracted) return draft.extracted as unknown as Proposal;
  const { label, usage } = await readLabel(photos, draft.hintName);
  await appendUsage(prisma, draft.id, [usage]);
  const match = label.barcode ? await findByBarcode(prisma, label.barcode) : null;
  const barcodeTaken = !!match && match.product.organizationId !== null && match.product.organizationId !== draft.organizationId;
  const candidates = label.brand ? await brandCandidates(prisma, label.brand, draft.organizationId) : [];
  const picked = await classify(prisma, label, candidates);
  await appendUsage(prisma, draft.id, [picked.usage]);
  const proposal: Proposal = { label, classification: picked.result, barcodeTaken };
  await prisma.catalogDraft.update({ where: { id: draft.id }, data: { extracted: proposal as object } });
  return proposal;
}

async function processShots(prisma: PrismaClient, draft: Draft, photos: Buffer[]) {
  const done = draft.processedImages as unknown as ProcessedShot[];
  const pending = photos.map((photo, index) => ({ photo, index })).filter(({ index }) => !done.some((s) => s.index === index));
  const results: ProcessedShot[] = [...done];
  for (let i = 0; i < pending.length; i += SHOT_CONCURRENCY) {
    await Promise.all(pending.slice(i, i + SHOT_CONCURRENCY).map(async ({ photo, index }) => {
      const { shot, usage } = await processShot(draft.id, index, photo);
      await Promise.all([appendShot(prisma, draft.id, shot), appendUsage(prisma, draft.id, usage)]);
      results.push(shot);
    }));
  }
  return results.sort((a, b) => a.index - b.index);
}

/** Why a draft can't go live on its own; empty means auto-publish */
export function reviewReasons(p: Proposal, draft: Pick<DraftForPublish, "mrp">) {
  const { label, classification: c } = p;
  const reasons: string[] = [];
  if (label.confidence.name !== "high") reasons.push("Product name is unclear in the photos");
  if (label.confidence.size !== "high") reasons.push("Pack size is unclear in the photos");
  if (!c.brand) reasons.push(label.brand ? `New brand "${label.brand}": approve to create it` : "No brand found on the pack");
  else if (c.brandConfidence !== "high") reasons.push(`Brand match "${c.brand.name}" is uncertain`);
  if (!c.subcategoryId) reasons.push("No aisle fits this product");
  else if (c.subcategoryConfidence !== "high") reasons.push(`Aisle "${c.subcategoryPath}" is uncertain`);
  if (label.printedMrp !== null && label.printedMrp !== Number(draft.mrp)) {
    reasons.push(`Pack says MRP ₹${label.printedMrp}, but ₹${Number(draft.mrp)} was entered`);
  }
  if (p.barcodeTaken) reasons.push("This barcode belongs to another organisation's product");
  return reasons;
}

/** Runs one claimed draft to PUBLISHED, DUPLICATE or NEEDS_REVIEW */
export async function runDraft(prisma: PrismaClient, id: string, log: ErrorLog) {
  const draft = await loadDraft(prisma, id);
  if (!draft || draft.status !== "PROCESSING") return;
  const photos = await Promise.all(draft.photos.map(fetchPhoto));
  const proposal = await propose(prisma, draft, photos);
  const match = proposal.label.barcode && !proposal.barcodeTaken ? await findByBarcode(prisma, proposal.label.barcode) : null;
  if (match) {
    await listExisting(prisma, draft, match);
    return;
  }
  const shots = await processShots(prisma, draft, photos);
  const reasons = reviewReasons(proposal, draft);
  if (reasons.length) {
    await prisma.catalogDraft.update({ where: { id }, data: { status: "NEEDS_REVIEW", reviewReasons: reasons, error: null } });
    return;
  }
  const productId = await publishNew(prisma, draft, proposal, shots);
  void translateNewProduct(prisma, productId, log);
}
