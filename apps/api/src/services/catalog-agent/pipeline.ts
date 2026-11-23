import type { PrismaClient } from "../../../generated/prisma/client.js";
import { catalogDraftItemSchema } from "@martly/shared/schemas";
import { describeItem, itemFacts, itemLabel, shotLegend } from "./describe-item.js";
import { readLabel } from "./extract.js";
import { processShot, type ProcessedShot } from "./images.js";
import { brandCandidates, classify, findByBarcode } from "./match.js";
import { fetchPhoto } from "./photos.js";
import { listExisting, publishNew, type DraftForPublish, type Proposal } from "./publish.js";
import type { UsageEntry } from "./usage.js";
import { drawItemSizeImage, drawLegendCopies } from "../item-sketch/redraw.js";
import { translateNewProduct, type ErrorLog } from "../translate/product.js";
import { listingBalance, listingsLeft, NO_LISTINGS_LEFT } from "../marketing/listing-credits.js";

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

/** An unpacked item has no label to read: AI names it from the photos and its confirmed size, then it's filed the same way */
async function proposeItem(prisma: PrismaClient, draft: Draft, photos: Buffer[]): Promise<Proposal> {
  const item = catalogDraftItemSchema.parse(draft.measurement);
  const described = await describeItem(photos, item, draft.hintName);
  await appendUsage(prisma, draft.id, [described.usage]);
  const label = itemLabel(described.result, item, photos.length);
  const picked = await classify(prisma, label, []);
  await appendUsage(prisma, draft.id, [picked.usage]);
  const facts = itemFacts(item, described.result.isContainer, described.result.material);
  const proposal: Proposal = { label, classification: picked.result, barcodeTaken: false, item: facts };
  await prisma.catalogDraft.update({ where: { id: draft.id }, data: { extracted: proposal as object } });
  return proposal;
}

/** Reads the label and files the product; saved on the draft so a requeued job skips straight to the photos */
async function propose(prisma: PrismaClient, draft: Draft, photos: Buffer[]): Promise<Proposal> {
  if (draft.extracted) return draft.extracted as unknown as Proposal;
  if (draft.kind === "ITEM") return proposeItem(prisma, draft, photos);
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
      const { shot, usage } = await processShot(draft.id, index, photo, draft.kind);
      await Promise.all([appendShot(prisma, draft.id, shot), appendUsage(prisma, draft.id, usage)]);
      results.push(shot);
    }));
  }
  return results.sort((a, b) => a.index - b.index);
}

/** Draws an item's size image from its cleaned photos; a requeued job that already has one keeps it */
async function withSizeImage(prisma: PrismaClient, draft: Draft, proposal: Proposal, shots: ProcessedShot[]): Promise<Proposal> {
  if (!proposal.item || proposal.item.sketchUrl) return proposal;
  const item = catalogDraftItemSchema.parse(draft.measurement);
  const inOrder = shots.map((s) => ({ ...s, legend: shotLegend(proposal.label, s.index, item.shape) }));
  const sketchUrl = await drawItemSizeImage(draft.id, item, inOrder, proposal.item.variant);
  const legendUrls = await drawLegendCopies(draft.id, inOrder);
  const marked: Proposal = { ...proposal, item: { ...proposal.item, sketchUrl, legendUrls, variant: { ...proposal.item.variant, sketchUrl } } };
  await prisma.catalogDraft.update({ where: { id: draft.id }, data: { extracted: marked as object } });
  return marked;
}

/** Why a draft can't go live on its own; empty means auto-publish, which only packs can do */
export function reviewReasons(p: Proposal, draft: Pick<DraftForPublish, "mrp">) {
  const { label, classification: c } = p;
  const reasons: string[] = [];
  if (p.item) {
    // A person always checks a measured item before it goes live
    reasons.push("Check the photos and size, then approve");
    if (label.confidence.name === "low") reasons.push("Couldn't tell what this item is from the photos");
    if (!c.subcategoryId) reasons.push("No aisle fits this item");
    else if (c.subcategoryConfidence === "low") reasons.push(`Aisle "${c.subcategoryPath}" is uncertain`);
    return reasons;
  }
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
  const proposed = await propose(prisma, draft, photos);
  const match = proposed.label.barcode && !proposed.barcodeTaken ? await findByBarcode(prisma, proposed.label.barcode) : null;
  if (match) {
    await listExisting(prisma, draft, match);
    return;
  }
  const shots = await processShots(prisma, draft, photos);
  const proposal = await withSizeImage(prisma, draft, proposed, shots);
  const reasons = reviewReasons(proposal, draft);
  // Martly's own staff aren't capped and don't use the store's listings
  const creator = await prisma.user.findUniqueOrThrow({ where: { id: draft.createdById }, select: { role: true } });
  const freeListing = creator.role === "SUPER_ADMIN";
  // With no listing left the draft waits for review, where approving asks the owner to buy more
  if (!freeListing && listingsLeft(await listingBalance(prisma, draft.organizationId)) === 0) reasons.push(NO_LISTINGS_LEFT);
  if (reasons.length) {
    await prisma.catalogDraft.update({ where: { id }, data: { status: "NEEDS_REVIEW", reviewReasons: reasons, error: null } });
    return;
  }
  const productId = await publishNew(prisma, draft, proposal, shots, {}, freeListing);
  void translateNewProduct(prisma, productId, log);
}
