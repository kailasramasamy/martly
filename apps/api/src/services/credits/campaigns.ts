import { MARTLY_CREDIT_FUNDER } from "@martly/shared/constants";
import type { CreditCampaignUsage, CreditOffer } from "@martly/shared/types";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { utc } from "../listing-sql.js";

type Db = PrismaClient | Prisma.TransactionClient;

export const funderKey = (campaign: { storeId: string | null }) => campaign.storeId ?? MARTLY_CREDIT_FUNDER;

export function liveCampaignWhere(now = new Date()): Prisma.CreditCampaignWhereInput {
  return { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}

const offerInclude = { store: { select: { name: true, logoUrl: true } } } satisfies Prisma.CreditCampaignInclude;
export type OfferCampaign = Prisma.CreditCampaignGetPayload<{ include: typeof offerInclude }>;

/** Spent and reserved credit leave room for one more grant */
export const hasBudgetFor = (campaign: { amount: unknown; budget: unknown }, usage: CreditCampaignUsage) =>
  usage.committed + Number(campaign.amount) <= Number(campaign.budget);

/** The running Martly campaign and, given a store, that store's own; the newest one per funder, while its budget lasts */
export async function offerCampaigns(db: Db, storeId: string | null): Promise<OfferCampaign[]> {
  const live = await db.creditCampaign.findMany({
    where: { AND: [liveCampaignWhere(), { OR: [{ storeId: null }, ...(storeId ? [{ storeId }] : [])] }] },
    include: offerInclude,
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  const newest = live.filter((c) => !seen.has(funderKey(c)) && !!seen.add(funderKey(c)));
  const usage = await campaignUsage(db, newest);
  return newest.filter((c) => hasBudgetFor(c, usage.get(c.id)!));
}

export function toOffer(c: OfferCampaign): CreditOffer {
  return {
    campaignId: c.id,
    storeId: c.storeId,
    storeName: c.store?.name ?? null,
    amount: Number(c.amount),
    minOrderAmount: Number(c.minOrderAmount),
    validDays: c.validDays,
    headline: c.headline,
    message: c.message,
    translations: c.translations as CreditOffer["translations"],
  };
}

interface UsageRow {
  campaign_id: string;
  granted: Prisma.Decimal | null;
  outstanding: Prisma.Decimal | null;
  reserved: Prisma.Decimal | null;
  spent: Prisma.Decimal | null;
  expired: Prisma.Decimal | null;
  grant_count: bigint;
  used_count: bigint;
}

const EMPTY_USAGE = { granted: 0, outstanding: 0, reserved: 0, spent: 0, expired: 0, grantCount: 0, usedCount: 0 };

/** Each campaign's grants by state; unused grants past their expiry count as expired before the sweep marks them */
export async function campaignUsage(db: Db, campaigns: { id: string; budget: unknown }[]): Promise<Map<string, CreditCampaignUsage>> {
  if (campaigns.length === 0) return new Map();
  const now = utc(new Date());
  const rows = await db.$queryRaw<UsageRow[]>`
    SELECT campaign_id,
      SUM(amount) AS granted,
      SUM(amount) FILTER (WHERE status = 'ACTIVE' AND expires_at > ${now}) AS outstanding,
      SUM(amount) FILTER (WHERE status = 'RESERVED') AS reserved,
      SUM(amount) FILTER (WHERE status = 'USED') AS spent,
      SUM(amount) FILTER (WHERE status = 'EXPIRED' OR (status = 'ACTIVE' AND expires_at <= ${now})) AS expired,
      COUNT(*) AS grant_count,
      COUNT(*) FILTER (WHERE status = 'USED') AS used_count
    FROM credit_grants
    WHERE campaign_id IN (${Prisma.join(campaigns.map((c) => c.id))})
    GROUP BY campaign_id`;
  const byId = new Map(rows.map((r) => [r.campaign_id, {
    granted: Number(r.granted ?? 0), outstanding: Number(r.outstanding ?? 0), reserved: Number(r.reserved ?? 0),
    spent: Number(r.spent ?? 0), expired: Number(r.expired ?? 0), grantCount: Number(r.grant_count), usedCount: Number(r.used_count),
  }]));
  return new Map(campaigns.map((c) => {
    const u = byId.get(c.id) ?? EMPTY_USAGE;
    const committed = u.spent + u.reserved;
    const headroom = Math.max(0, Number(c.budget) - committed);
    return [c.id, { ...u, committed, possibleOverrun: Math.max(0, u.outstanding - headroom) }];
  }));
}
