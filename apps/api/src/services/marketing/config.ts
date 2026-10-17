import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;
export type SponsorCaps = Partial<Record<"STORE" | "BRAND" | "PLATFORM", number>>;
export type SlotLimits = Partial<Record<string, SponsorCaps>>;

const CONFIG_ID = "default";

/** Platform marketing settings; the row is created with defaults the first time it's needed */
export async function getMarketingConfig(db: Db) {
  const config = await db.marketingConfig.upsert({ where: { id: CONFIG_ID }, create: { id: CONFIG_ID }, update: {} });
  return { ...config, gstPercent: Number(config.gstPercent), slotLimits: config.slotLimits as SlotLimits };
}

export type MarketingConfig = Awaited<ReturnType<typeof getMarketingConfig>>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Price with GST: CGST + SGST when the buyer is in the seller's state, IGST otherwise (or when the state is unknown) */
export function quote(unitPrice: number, quantity: number, gstPercent: number, sameState: boolean) {
  const subtotal = round2(unitPrice * quantity);
  const tax = round2((subtotal * gstPercent) / 100);
  const half = round2(tax / 2);
  return {
    unitPrice, subtotal, gstPercent,
    cgst: sameState ? half : 0,
    sgst: sameState ? round2(tax - half) : 0,
    igst: sameState ? 0 : tax,
    total: round2(subtotal + tax),
  };
}

/** GST invoices are numbered per Indian financial year (April to March), e.g. MKT/2026-27/0001 */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, prefix: string, at = new Date()) {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() >= 3 ? year : year - 1;
  const fy = `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  const { last } = await tx.marketingInvoiceCounter.upsert({
    where: { fy }, create: { fy, last: 1 }, update: { last: { increment: 1 } },
  });
  return `${prefix}/${fy}/${String(last).padStart(4, "0")}`;
}
