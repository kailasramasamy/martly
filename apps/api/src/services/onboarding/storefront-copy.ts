import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import type { CopyStorefrontInput } from "@martly/shared/schemas";
import type { StorefrontCopyResult } from "@martly/shared/types";
import type { HomeSectionType } from "@martly/shared/constants";
import { firstFreeSlug } from "./owner.js";
import { remapSectionConfig, resolveCollection, type CollectionMap } from "./home-remap.js";

type Tx = Prisma.TransactionClient;
type Store = { id: string; organizationId: string };
type Org = { id: string; slug: string };

// A copied collection needs this many products the new store sells, or it would show a near-empty row
const MIN_ITEMS = 4;

const json = (v: Prisma.JsonValue | null) => (v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/** Removes an earlier copy so the step can be re-run while the store is still being set up */
async function clearPrevious(tx: Tx, store: Store) {
  const orgId = store.organizationId;
  await tx.homeSection.deleteMany({ where: { organizationId: orgId } });
  await tx.banner.deleteMany({ where: { organizationId: orgId, brandCampaignId: null, promoId: null } });
  await tx.collection.deleteMany({ where: { organizationId: orgId, festivalEventId: null, promo: null } });
  await tx.membershipPlan.deleteMany({ where: { organizationId: orgId, userMemberships: { none: {} } } });
  await tx.deliverySlot.deleteMany({ where: { storeId: store.id, orders: { none: {} } } });
}

/** Template collections a new organisation can use: plain, current, not festival (built per organisation) or promo-run */
function sourceCollections(tx: Tx, templateId: string) {
  return tx.collection.findMany({
    where: {
      organizationId: templateId, kind: "STANDARD", festivalEventId: null, promo: null,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    include: { items: { orderBy: { sortOrder: "asc" } }, tiles: true },
  });
}

async function copyCollections(tx: Tx, templateId: string, org: Org, listed: Set<string>) {
  // Every template collection starts unmapped, so nothing copied can point back at the template's own collections
  const all = await tx.collection.findMany({ where: { organizationId: templateId }, select: { id: true } });
  const map: CollectionMap = new Map(all.map((c) => [c.id, null]));
  const dropped: string[] = [];
  const taken = (await tx.collection.findMany({ where: { slug: { endsWith: org.slug } }, select: { slug: true } })).map((c) => c.slug);
  for (const c of await sourceCollections(tx, templateId)) {
    const items = c.items.filter((i) => listed.has(i.productId));
    if (items.length < MIN_ITEMS && c.tiles.length === 0) {
      dropped.push(c.title);
      continue;
    }
    const { id: _id, items: _i, tiles, createdAt: _c, updatedAt: _u, slug, organizationId: _o, ...fields } = c;
    const newSlug = firstFreeSlug(`${slug}-${org.slug}`, taken);
    taken.push(newSlug);
    const copy = await tx.collection.create({
      data: {
        ...fields, slug: newSlug, organizationId: org.id,
        translations: json(c.translations), imageUrls: json(c.imageUrls), heroTheme: json(c.heroTheme),
        items: { create: items.map((i, n) => ({ productId: i.productId, sortOrder: n })) },
        tiles: { create: tiles.map(({ title, imageUrl, subcategoryIds, sortOrder, translations }) => ({ title, imageUrl, subcategoryIds, sortOrder, translations: json(translations) })) },
      },
    });
    map.set(c.id, copy.id);
  }
  return { map, dropped };
}

async function copySections(tx: Tx, templateId: string, orgId: string, map: CollectionMap, templateBrands: Set<string>) {
  const sections = await tx.homeSection.findMany({ where: { organizationId: templateId }, include: { items: true }, orderBy: { sortOrder: "asc" } });
  let copied = 0;
  for (const s of sections) {
    const collectionId = s.collectionId ? resolveCollection(map, s.collectionId) : null;
    const config = remapSectionConfig(s.type as HomeSectionType, s.config, map, templateBrands);
    const items = s.items.flatMap((i) => {
      const id = i.collectionId ? resolveCollection(map, i.collectionId) : null;
      return i.collectionId && !id ? [] : [{ ...i, collectionId: id }];
    });
    if (config === null || (s.collectionId && !collectionId) || (s.items.length > 0 && items.length === 0)) continue;
    await tx.homeSection.create({
      data: {
        organizationId: orgId, type: s.type, title: s.title, subtitle: s.subtitle, translations: json(s.translations),
        collectionId, config: config as Prisma.InputJsonValue, sortOrder: copied, isActive: s.isActive,
        items: { create: items.map(({ label, translations, imageUrl, collectionId: cid, subcategoryIds, wide, sortOrder }) => ({ label, translations: json(translations), imageUrl, collectionId: cid, subcategoryIds, wide, sortOrder })) },
      },
    });
    copied++;
  }
  return { copied, skipped: sections.length - copied };
}

/** Plain store banners only: brand campaigns and promotions belong to the template */
async function copyBanners(tx: Tx, templateId: string, store: Store, map: CollectionMap, listed: Set<string>, templateBrands: Set<string>) {
  const banners = await tx.banner.findMany({
    where: {
      organizationId: templateId, sponsorType: "STORE", brandCampaignId: null, promoId: null,
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
  });
  let copied = 0;
  for (const b of banners) {
    let actionTarget = b.actionTarget;
    if (b.actionType === "COLLECTION" && actionTarget) actionTarget = resolveCollection(map, actionTarget);
    if (b.actionType === "PRODUCT" && actionTarget && !listed.has(actionTarget)) actionTarget = null;
    if (b.actionType === "BRAND" && actionTarget && templateBrands.has(actionTarget)) actionTarget = null;
    if (b.actionType !== "NONE" && !actionTarget) continue;
    const { id: _id, createdAt: _c, updatedAt: _u, viewsServed: _v, targetStoreIds: _t, ...fields } = b;
    await tx.banner.create({
      data: {
        ...fields, actionTarget, organizationId: store.organizationId, storeId: b.storeId ? store.id : null,
        imageUrls: json(b.imageUrls),
      },
    });
    copied++;
  }
  return copied;
}

async function copyMemberships(tx: Tx, templateId: string, orgId: string) {
  const plans = await tx.membershipPlan.findMany({ where: { organizationId: templateId } });
  await tx.membershipPlan.createMany({
    data: plans.map(({ id: _id, createdAt: _c, updatedAt: _u, ...p }) => ({ ...p, organizationId: orgId })),
  });
  return plans.length;
}

async function copyLoyalty(tx: Tx, templateId: string, orgId: string) {
  const config = await tx.loyaltyConfig.findUnique({ where: { organizationId: templateId } });
  if (!config) return false;
  const { id: _id, createdAt: _c, updatedAt: _u, organizationId: _o, ...data } = config;
  await tx.loyaltyConfig.upsert({ where: { organizationId: orgId }, update: data, create: { ...data, organizationId: orgId } });
  return true;
}

async function copyReferrals(tx: Tx, templateId: string, orgId: string) {
  const config = await tx.referralConfig.findUnique({ where: { organizationId: templateId } });
  if (!config) return false;
  const { id: _id, createdAt: _c, updatedAt: _u, organizationId: _o, ...data } = config;
  await tx.referralConfig.upsert({ where: { organizationId: orgId }, update: data, create: { ...data, organizationId: orgId } });
  return true;
}

async function copySlots(tx: Tx, templateId: string, storeId: string) {
  const source = await tx.store.findFirst({ where: { organizationId: templateId, deliverySlots: { some: {} } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const slots = source ? await tx.deliverySlot.findMany({ where: { storeId: source.id } }) : [];
  await tx.deliverySlot.createMany({
    data: slots.map(({ dayOfWeek, startTime, endTime, maxOrders, cutoffMinutes, isActive }) => ({ storeId, dayOfWeek, startTime, endTime, maxOrders, cutoffMinutes, isActive })),
    skipDuplicates: true,
  });
  return slots.length;
}

/** Copies the chosen parts of a template organisation's storefront into a store that is still being set up */
export async function copyStorefront(prisma: PrismaClient, store: Store, input: CopyStorefrontInput): Promise<StorefrontCopyResult> {
  const parts = new Set(input.parts);
  const templateId = input.templateOrganizationId;
  const listedRows = await prisma.storeProduct.findMany({ where: { storeId: store.id }, select: { productId: true }, distinct: ["productId"] });
  const listed = new Set(listedRows.map((r) => r.productId));
  const templateBrands = new Set((await prisma.brand.findMany({ where: { organizationId: templateId }, select: { id: true } })).map((b) => b.id));
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: store.organizationId }, select: { id: true, slug: true } });
    await clearPrevious(tx, store);
    const wantsCollections = parts.has("homeLayout") || parts.has("banners");
    const { map, dropped } = wantsCollections ? await copyCollections(tx, templateId, org, listed) : { map: new Map(), dropped: [] };
    const sections = parts.has("homeLayout") ? await copySections(tx, templateId, org.id, map, templateBrands) : { copied: 0, skipped: 0 };
    return {
      collections: [...map.values()].filter(Boolean).length,
      droppedCollections: dropped,
      sections: sections.copied,
      skippedSections: sections.skipped,
      banners: parts.has("banners") ? await copyBanners(tx, templateId, store, map, listed, templateBrands) : 0,
      membershipPlans: parts.has("memberships") ? await copyMemberships(tx, templateId, org.id) : 0,
      loyalty: parts.has("loyalty") ? await copyLoyalty(tx, templateId, org.id) : false,
      referrals: parts.has("referrals") ? await copyReferrals(tx, templateId, org.id) : false,
      deliverySlots: parts.has("deliverySlots") ? await copySlots(tx, templateId, store.id) : 0,
    };
  }, { timeout: 60_000 });
}
