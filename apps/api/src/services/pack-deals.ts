import type { PrismaClient } from "../../generated/prisma/client.js";
import { decorateStoreProducts, storeProductInclude, type StoreProductView } from "./store-product-view.js";

// Sizes in a common unit so 500 g and 1 kg compare; packs and bundles have no size to compare
const BASE_UNITS: Record<string, { base: string; factor: number }> = {
  KG: { base: "g", factor: 1000 },
  GRAM: { base: "g", factor: 1 },
  LITER: { base: "ml", factor: 1000 },
  ML: { base: "ml", factor: 1 },
  PIECE: { base: "pc", factor: 1 },
  DOZEN: { base: "pc", factor: 12 },
};
// Offer at most three times what the cart holds (no 5 kg tin for a 500 g line), and only savings worth a tap
const MAX_UPSIZE = 3;
const MIN_SAVING = 2;

type Size = { base: string; amount: number };

export interface PackDeal {
  /** The cart line it replaces */
  storeProductId: string;
  to: StoreProductView;
  quantity: number;
  /** What the cart total goes up by (0 when the same amount simply costs less) */
  extra: number;
  /** What the new amount would cost in the line's size, minus what it costs in the bigger one */
  saves: number;
}

function sizeOf(variant: { unitType: string; unitValue: unknown }): Size | null {
  const unit = BASE_UNITS[variant.unitType];
  const value = Number(variant.unitValue);
  return unit && value > 0 ? { base: unit.base, amount: value * unit.factor } : null;
}

const priceOf = (sp: StoreProductView, isMember: boolean) =>
  isMember && sp.pricing.memberPrice != null ? Math.min(sp.pricing.memberPrice, sp.pricing.effectivePrice) : sp.pricing.effectivePrice;

// The bigger size that saves the most on at least the amount the line holds
function bestDeal(line: StoreProductView, quantity: number, others: StoreProductView[], sizes: Map<string, Size>, isMember: boolean) {
  const own = sizes.get(line.id);
  if (!own) return null;
  const unitPrice = priceOf(line, isMember) / own.amount;
  const volume = own.amount * quantity;
  let best: PackDeal | null = null;
  for (const to of others) {
    const size = sizes.get(to.id);
    if (!size || size.base !== own.base || size.amount <= own.amount || size.amount > volume * MAX_UPSIZE) continue;
    const packs = Math.ceil(volume / size.amount);
    if (packs > to.availableStock) continue;
    const cost = packs * priceOf(to, isMember);
    const saves = Math.round(packs * size.amount * unitPrice - cost);
    if (saves < MIN_SAVING || (best && saves <= best.saves)) continue;
    best = { storeProductId: line.id, to, quantity: packs, extra: Math.max(0, Math.round(cost - quantity * priceOf(line, isMember))), saves };
  }
  return best;
}

/** For each cart line, a bigger size of the same product that's cheaper per kg / litre / piece, when the store has one */
export async function packDeals(prisma: PrismaClient, storeId: string, lines: StoreProductView[], quantities: Map<string, number>, isMember: boolean) {
  if (lines.length === 0) return [];
  const rows = await prisma.storeProduct.findMany({
    where: { storeId, isActive: true, productId: { in: [...new Set(lines.map((l) => l.productId))] } },
    include: storeProductInclude,
  });
  const sizes = new Map(rows.flatMap((r) => {
    const size = sizeOf(r.variant);
    return size ? [[r.id, size] as const] : [];
  }));
  const inCart = new Set(lines.map((l) => l.id));
  const options = await decorateStoreProducts(prisma, rows.filter((r) => !inCart.has(r.id) && r.stock - r.reservedStock > 0));
  return lines.flatMap((line) => {
    const deal = bestDeal(line, quantities.get(line.id) ?? 1, options.filter((o) => o.productId === line.productId), sizes, isMember);
    return deal ? [deal] : [];
  });
}
