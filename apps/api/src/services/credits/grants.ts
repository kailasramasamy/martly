import type { CreditGrantView, CustomerCredits } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { deliveryFeeTo } from "../delivery/fee.js";
import { RESOLVE_RADIUS_KM, liveStoreWhere } from "../store-resolve.js";
import { campaignUsage, funderKey, hasBudgetFor, offerCampaigns, toOffer, type OfferCampaign } from "./campaigns.js";

type Db = PrismaClient | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

/** New means no order that went ahead: anywhere for Martly's credit, at the store for a store's own */
export async function isNewCustomer(db: Db, userId: string, storeId: string | null) {
  const orders = await db.order.count({ where: { userId, status: { not: "CANCELLED" }, ...(storeId ? { storeId } : {}) } });
  return orders === 0;
}

/** Campaigns this customer could still be given: they're new to the funder and their phone hasn't had its credit */
async function unclaimed(db: Db, user: { id: string; phone: string | null }, campaigns: OfferCampaign[]) {
  if (!user.phone) return [];
  const had = await db.creditGrant.findMany({
    where: { phone: user.phone, funderKey: { in: campaigns.map(funderKey) } }, select: { funderKey: true },
  });
  const taken = new Set(had.map((g) => g.funderKey));
  const open = [];
  for (const c of campaigns) {
    if (!taken.has(funderKey(c)) && await isNewCustomer(db, user.id, c.storeId)) open.push(c);
  }
  return open;
}

/** Grants one campaign's credit under its row lock, so parallel claims can't pass the budget; null when it's spent */
async function grantOne(prisma: PrismaClient, campaign: OfferCampaign, user: { id: string; phone: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM credit_campaigns WHERE id = ${campaign.id} FOR UPDATE`;
    if (!hasBudgetFor(campaign, (await campaignUsage(tx, [campaign])).get(campaign.id)!)) return null;
    return tx.creditGrant.create({
      data: {
        campaignId: campaign.id, userId: user.id, phone: user.phone, funderKey: funderKey(campaign),
        amount: campaign.amount, expiresAt: new Date(Date.now() + campaign.validDays * DAY_MS),
      },
    });
  }).catch((err: unknown) => {
    // Another claim for the same phone won the race
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
    throw err;
  });
}

/**
 * Gives a new customer the welcome credit once they can order from a store, by delivery or by picking up from one
 * nearby, so customers far from every store never take budget. Returns how many grants were made.
 */
export async function claimCredits(prisma: PrismaClient, userId: string, storeId: string, point: { lat: number; lng: number }) {
  const store = await prisma.store.findFirst({ where: { id: storeId, ...liveStoreWhere } });
  if (!store) throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  const reach = await deliveryFeeTo(prisma, storeId, store, point);
  const canPickUp = reach.distance !== undefined && reach.distance <= RESOLVE_RADIUS_KM;
  if (!reach.serviceable && !canPickUp) throw Object.assign(new Error("This store is too far from your location"), { statusCode: 400 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, phone: true, role: true } });
  if (user.role !== "CUSTOMER" || !user.phone) return 0;
  const open = await unclaimed(prisma, user, await offerCampaigns(prisma, storeId));
  let granted = 0;
  for (const campaign of open) {
    if (await grantOne(prisma, campaign, { id: user.id, phone: user.phone })) granted++;
  }
  return granted;
}

const grantInclude = { campaign: { include: { store: { select: { name: true, logoUrl: true } } } } } satisfies Prisma.CreditGrantInclude;

function toGrantView(g: Prisma.CreditGrantGetPayload<{ include: typeof grantInclude }>): CreditGrantView {
  return {
    id: g.id,
    campaignId: g.campaignId,
    storeId: g.campaign.storeId,
    storeName: g.campaign.store?.name ?? null,
    storeLogoUrl: g.campaign.store?.logoUrl ?? null,
    amount: Number(g.amount),
    minOrderAmount: Number(g.campaign.minOrderAmount),
    status: g.status,
    expiresAt: g.expiresAt.toISOString(),
    announced: g.announcedAt !== null,
    headline: g.campaign.headline,
    message: g.campaign.message,
    translations: g.campaign.translations as CreditGrantView["translations"],
  };
}

/** The customer's unused credit, and offers they qualify for but haven't been given (Martly's, plus the store's when given) */
export async function customerCredits(prisma: PrismaClient, userId: string, storeId: string | null): Promise<CustomerCredits> {
  const [grants, user] = await Promise.all([
    prisma.creditGrant.findMany({
      where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } }, include: grantInclude, orderBy: { expiresAt: "asc" },
    }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, phone: true, role: true } }),
  ]);
  const pending = user.role === "CUSTOMER" ? await unclaimed(prisma, user, await offerCampaigns(prisma, storeId)) : [];
  return { grants: grants.map(toGrantView), pending: pending.map(toOffer) };
}

/** For guests: what signing up would get them, Martly's and the store's */
export async function guestOffers(prisma: PrismaClient, storeId: string | null) {
  return (await offerCampaigns(prisma, storeId)).map(toOffer);
}
