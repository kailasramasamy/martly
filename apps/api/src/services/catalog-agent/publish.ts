import type { ApproveCatalogDraftInput, CatalogDraftSizeInput } from "@martly/shared/schemas";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { Label } from "./extract.js";
import type { ProcessedShot } from "./images.js";
import type { Classification } from "./match.js";
import { uniqueBrandSlug } from "../brands.js";
import { recordOpeningStock } from "../stock-ledger.js";

/** Everything the agent decided, kept on the draft so a reviewer can see and correct it */
export interface Proposal {
  label: Label;
  classification: Classification;
  // EAN already used by another organisation's product: the new variant is created without it
  barcodeTaken: boolean;
}

export interface DraftForPublish {
  id: string;
  organizationId: string;
  storeId: string;
  mrp: Prisma.Decimal | number;
  sellingPrice: Prisma.Decimal | number;
  stock: number;
  createdById: string;
}

type Tx = Prisma.TransactionClient;

export class DraftStateError extends Error {}
export class DraftSizeError extends Error {}

const skuBase = (draftId: string) => `CD-${draftId.slice(0, 8).toUpperCase()}`;

/** Extra pack sizes on a drafted product, each listed in the draft's store with its own price and stock */
export async function addSizes(tx: Tx, draft: Pick<DraftForPublish, "id" | "storeId" | "createdById">, productId: string, sizes: CatalogDraftSizeInput[]) {
  if (!sizes.length) return;
  const existing = await tx.productVariant.findMany({ where: { productId }, select: { name: true } });
  const seen = new Set(existing.map((v) => v.name.toLowerCase()));
  for (const size of sizes) {
    const key = size.name.toLowerCase();
    if (seen.has(key)) throw new DraftSizeError(`This product already has a size called "${size.name}"`);
    seen.add(key);
  }
  const listings = [];
  for (const [i, size] of sizes.entries()) {
    const variant = await tx.productVariant.create({
      data: {
        productId, name: size.name, unitType: size.unitType, unitValue: size.unitValue, mrp: size.mrp,
        sku: `${skuBase(draft.id)}-${existing.length + i + 1}`,
      },
    });
    listings.push(await tx.storeProduct.create({
      data: { storeId: draft.storeId, productId, variantId: variant.id, price: size.sellingPrice, stock: size.stock },
    }));
  }
  await recordOpeningStock(tx, listings, draft.createdById);
}

function nutritionMap(label: Label) {
  if (!label.nutrition.length) return undefined;
  return Object.fromEntries(label.nutrition.map((n) => [n.name, n.value]));
}

function productData(draft: DraftForPublish, p: Proposal, shots: ProcessedShot[], edits: ApproveCatalogDraftInput, brandId: string | null) {
  const { label, classification } = p;
  const front = shots.find((s) => label.shots.find((r) => r.index === s.index)?.role === "front") ?? shots[0];
  return {
    organizationId: draft.organizationId,
    name: edits.name ?? label.name,
    description: edits.description ?? label.description,
    imageUrl: front?.url ?? null,
    images: shots.map((s) => s.url),
    subcategoryId: edits.subcategoryId ?? classification.subcategoryId,
    brandId,
    tags: label.tags,
    foodType: edits.foodType ?? label.foodType,
    productType: label.productType,
    fssaiLicense: label.fssaiLicense,
    ingredients: label.ingredients,
    nutritionalInfo: nutritionMap(label),
    allergens: label.allergens,
    shelfLifeDays: label.shelfLifeDays,
    storageType: label.storageType,
    storageInstructions: label.storageInstructions,
    usageInstructions: label.usageInstructions,
    dangerWarnings: label.dangerWarnings,
    manufacturerName: label.manufacturerName,
    countryOfOrigin: label.countryOfOrigin,
  };
}

/** A brand named while approving a draft becomes the organisation's own local brand */
async function createBrand(tx: Tx, name: string, organizationId: string) {
  return tx.brand.create({ data: { name, slug: await uniqueBrandSlug(tx, name), organizationId } });
}

async function resolveBrandId(tx: Tx, p: Proposal, edits: ApproveCatalogDraftInput, organizationId: string) {
  if (edits.brandId) return edits.brandId;
  if (edits.newBrandName) return (await createBrand(tx, edits.newBrandName, organizationId)).id;
  return p.classification.brand?.id ?? null;
}

/** Creates the org's product, its variants and this store's listings in one transaction, and closes the draft */
export async function publishNew(prisma: PrismaClient, draft: DraftForPublish, p: Proposal, shots: ProcessedShot[], edits: ApproveCatalogDraftInput = {}) {
  return prisma.$transaction(async (tx) => {
    const brandId = await resolveBrandId(tx, p, edits, draft.organizationId);
    const mrp = edits.mrp ?? Number(draft.mrp);
    const product = await tx.product.create({
      data: {
        ...productData(draft, p, shots, edits, brandId),
        variants: {
          create: {
            name: edits.variantName ?? p.label.variantName,
            unitType: edits.unitType ?? p.label.unitType,
            unitValue: edits.unitValue ?? p.label.unitValue,
            mrp,
            sku: skuBase(draft.id),
            barcode: p.barcodeTaken ? null : p.label.barcode,
            imageUrl: shots[0]?.url ?? null,
          },
        },
      },
      select: { id: true, variants: { select: { id: true } } },
    });
    const listing = await tx.storeProduct.create({
      data: {
        storeId: draft.storeId, productId: product.id, variantId: product.variants[0].id,
        price: edits.sellingPrice ?? Number(draft.sellingPrice), stock: edits.stock ?? draft.stock,
      },
    });
    await recordOpeningStock(tx, [listing], draft.createdById);
    await addSizes(tx, draft, product.id, edits.extraSizes ?? []);
    const closed = await tx.catalogDraft.updateMany({
      where: { id: draft.id, status: { in: ["PROCESSING", "NEEDS_REVIEW"] } },
      data: { status: "PUBLISHED", productId: product.id, error: null },
    });
    // Approved twice at once, or discarded meanwhile: roll the product back
    if (!closed.count) throw new DraftStateError("This draft was already handled");
    return product.id;
  });
}

/** The product is already in the catalog: list it in this store, unless the store already sells it */
export async function listExisting(prisma: PrismaClient, draft: DraftForPublish, match: { id: string; productId: string }) {
  return prisma.$transaction(async (tx) => {
    const listed = await tx.storeProduct.findUnique({ where: { storeId_variantId: { storeId: draft.storeId, variantId: match.id } } });
    if (!listed) {
      const listing = await tx.storeProduct.create({
        data: { storeId: draft.storeId, productId: match.productId, variantId: match.id, price: Number(draft.sellingPrice), stock: draft.stock },
      });
      await recordOpeningStock(tx, [listing], draft.createdById);
    }
    const status = listed ? "DUPLICATE" : "PUBLISHED";
    await tx.catalogDraft.update({ where: { id: draft.id }, data: { status, productId: match.productId, matchedExisting: true, error: null } });
    return status;
  });
}
