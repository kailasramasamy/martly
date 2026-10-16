import type { PrismaClient } from "../../../generated/prisma/client.js";

export interface CountItem {
  storeProductId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  countedQty: number | null;
  /** Only for approvers, and only once submitted — counting is blind */
  systemQty?: number | null;
  difference?: number | null;
  /** Approvers only: sent back for recount, already applied to stock, and the line's history */
  recountRequested?: boolean;
  applied?: boolean;
  revisions?: { kind: string; qty: number; reason: string | null; userName: string; createdAt: Date }[];
}

const LINE_INCLUDE = {
  revisions: {
    orderBy: { createdAt: "asc" as const },
    select: { kind: true, qty: true, reason: true, createdAt: true, user: { select: { name: true } } },
  },
};

interface ProductRow { id: string; product: { name: string; imageUrl: string | null }; variant: { name: string } }
interface LineRow {
  countedQty: number; recountQty: number | null; systemQty: number | null; recountRequested: boolean; appliedAt: Date | null;
  revisions: { kind: string; qty: number; reason: string | null; createdAt: Date; user: { name: string } }[];
}

/** One product of the aisle as this viewer may see it: blind numbers for counters, everything for approvers */
function toItem(sp: ProductRow, line: LineRow | undefined, view: { reveal: boolean; recounting: boolean }): CountItem {
  const item: CountItem = {
    storeProductId: sp.id,
    productName: sp.product.name,
    variantName: sp.variant.name,
    imageUrl: sp.product.imageUrl,
    countedQty: view.recounting ? line?.recountQty ?? null : line?.countedQty ?? null,
  };
  if (view.reveal && line) {
    item.systemQty = line.systemQty;
    item.difference = line.systemQty === null ? null : line.countedQty - line.systemQty;
    item.recountRequested = line.recountRequested;
    item.applied = !!line.appliedAt;
    item.revisions = line.revisions.map(({ user, ...r }) => ({ ...r, userName: user.name }));
  }
  return item;
}

/** A count with every product in its store and aisle, merged with what has been counted so far */
export async function countDetail(prisma: PrismaClient, id: string, showSystem: boolean) {
  const count = await prisma.stockCount.findUniqueOrThrow({
    where: { id },
    include: {
      store: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      lines: { include: LINE_INCLUDE },
    },
  });
  const products = await prisma.storeProduct.findMany({
    where: { storeId: count.storeId, product: { subcategoryId: count.subcategoryId } },
    select: { id: true, product: { select: { name: true, imageUrl: true } }, variant: { select: { name: true } } },
    orderBy: [{ product: { name: "asc" } }, { variant: { name: "asc" } }],
  });
  const { lines, ...rest } = count;
  const lineBy = new Map(lines.map((l) => [l.storeProductId, l]));
  const reveal = showSystem && rest.status !== "DRAFT";
  // A counter redoing a recount sees only the flagged lines, blank until they enter a new number
  const recounting = !showSystem && rest.status === "RECOUNT";
  const shown = recounting ? products.filter((sp) => lineBy.get(sp.id)?.recountRequested) : products;
  const items = shown.map((sp) => toItem(sp, lineBy.get(sp.id), { reveal, recounting }));
  const countedItems = recounting ? items.filter((i) => i.countedQty !== null).length : lines.length;
  return { ...rest, items, countedItems, recountItems: lines.filter((l) => l.recountRequested).length, canSeeSystemStock: reveal };
}
