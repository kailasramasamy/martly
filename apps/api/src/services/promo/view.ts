import type { PromoDetail, PromoProduct, PromoSummary } from "@martly/shared/types";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { describeProducts, type ProductFacts } from "./catalog.js";
import { planChanges } from "./pricing.js";
import { getMarketingConfig } from "../marketing/config.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const promoSummaryInclude = {
  collection: { select: { title: true, imageUrl: true, _count: { select: { items: true } } } },
} satisfies Prisma.PromoInclude;

type SummaryRow = Prisma.PromoGetPayload<{ include: typeof promoSummaryInclude }>;

export function toSummary(p: SummaryRow): PromoSummary {
  return {
    id: p.id, brief: p.brief, status: p.status, autoLaunch: p.autoLaunch, notify: p.notify,
    title: p.collection?.title ?? null, imageUrl: p.collection?.imageUrl ?? null,
    discountType: p.discountType, discountValue: p.discountValue == null ? null : Number(p.discountValue),
    productCount: p.collection?._count.items ?? 0,
    startsAt: p.startsAt?.toISOString() ?? null, endsAt: p.endsAt?.toISOString() ?? null,
    failureReason: p.failureReason, createdAt: p.createdAt.toISOString(),
  };
}

function discounted(price: number, type: string | null, value: number | null) {
  if (!type || value == null) return null;
  const after = type === "PERCENTAGE" ? price * (1 - value / 100) : Math.max(0, price - value);
  return Math.round(after * 100) / 100;
}

function toProduct(f: ProductFacts, type: string | null, value: number | null): PromoProduct {
  return {
    productId: f.id, name: f.name, brand: f.brand, imageUrl: f.image_url, subcategory: f.subcategory,
    priceMin: f.price_min, priceMax: f.price_max,
    promoPriceMin: discounted(f.price_min, type, value), promoPriceMax: discounted(f.price_max, type, value),
  };
}

/** Before launch: what launching now would change. After: what it did change. */
async function priceChanges(prisma: PrismaClient, p: SummaryRow, productIds: string[]) {
  if (!p.discountType || p.discountValue == null || productIds.length === 0) return null;
  if (p.status === "READY") {
    const startsAt = new Date();
    const plan = await planChanges(prisma, {
      organizationId: p.organizationId, productIds, type: p.discountType, value: Number(p.discountValue),
      startsAt, endsAt: new Date(startsAt.getTime() + p.durationDays * DAY_MS),
    });
    return { listings: plan.change.length, stores: plan.stores, keptExisting: plan.keptExisting };
  }
  if (p.status !== "LIVE" && p.status !== "ENDED") return null;
  const changes = await prisma.promoPriceChange.findMany({ where: { promoId: p.id }, select: { storeProduct: { select: { storeId: true } } } });
  const listings = await prisma.storeProduct.count({
    where: { productId: { in: productIds }, isActive: true, store: { organizationId: p.organizationId, status: "ACTIVE" } },
  });
  const stores = new Set(changes.map((c) => c.storeProduct.storeId)).size;
  return { listings: changes.length, stores, keptExisting: Math.max(0, listings - changes.length) };
}

export async function toDetail(prisma: PrismaClient, promoId: string, organizationId: string | undefined): Promise<PromoDetail | null> {
  const p = await prisma.promo.findFirst({
    where: { id: promoId, ...(organizationId ? { organizationId } : {}) },
    include: {
      ...promoSummaryInclude,
      collection: { include: { items: { orderBy: { sortOrder: "asc" }, select: { productId: true } }, _count: { select: { items: true } } } },
      campaign: { select: { recipientCount: true, sentAt: true } },
    },
  });
  if (!p) return null;
  const c = p.collection;
  const productIds = c?.items.map((i) => i.productId) ?? [];
  const value = p.discountValue == null ? null : Number(p.discountValue);
  const facts = await describeProducts(prisma, p.organizationId, productIds);
  return {
    ...toSummary(p), collectionId: p.collectionId, assumptions: p.assumptions,
    log: p.agentLog as PromoDetail["log"], copy: p.copy as PromoDetail["copy"], push: p.push as PromoDetail["push"],
    images: c ? ((c.imageUrls as Record<string, string> | null) ?? (c.imageUrl ? { art: c.imageUrl } : null)) : null,
    textInImage: c?.textInImage ?? false,
    products: facts.map((f) => toProduct(f, p.discountType, value)),
    priceChanges: await priceChanges(prisma, p, productIds),
    pushSent: p.campaign?.sentAt ? { recipients: p.campaign.recipientCount, at: p.campaign.sentAt.toISOString() } : null,
    chargedFrom: p.chargedFrom, uploadedImage: Boolean(p.uploadedImageUrl),
    redraftsLeft: Math.max(0, (await getMarketingConfig(prisma)).freeRegenerations - p.regenerations),
  };
}
