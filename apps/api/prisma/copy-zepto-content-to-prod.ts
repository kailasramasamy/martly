/**
 * Copies the Zepto-style Home content made locally (Phases 1–4) to prod without syncing anything else: new collections
 * with their items, Martly Template' Home layout, the advertised coupons, and the live brand posters and sponsored ad.
 * Insert-only with the same ids (existing rows are skipped). Layout sections prod already has (same type and title)
 * are updated in place rather than duplicated; nothing on prod is deleted. All prod writes run in one transaction.
 *
 *   cd apps/api && npx tsx prisma/copy-zepto-content-to-prod.ts            # dry run: prints what would change
 *   cd apps/api && npx tsx prisma/copy-zepto-content-to-prod.ts --apply
 */
import "../src/load-env.js";
import { Prisma, PrismaClient } from "../generated/prisma/index.js";

const ORG_NAME = "Martly Template";
const COUPONS = ["WELCOME50", "SAVE20", "SNACK30"];
// Brand campaigns to carry over, by title (the live posters and the sponsored product)
const CAMPAIGNS = ["Make every moment sweeter", "The taste of India", "Lay's in your snack aisle"];
// Local test content that isn't part of the Zepto work
const SKIP_SLUGS = ["brand-e14a5a8d-1594e296"];

const local = new PrismaClient();
const prod = new PrismaClient({ datasourceUrl: process.env.PROD_DATABASE_URL });
const apply = process.argv.includes("--apply");
const json = (v: unknown) => (v ?? Prisma.JsonNull) as Prisma.InputJsonValue;

async function newCollections(organizationId: string) {
  const mine = await local.collection.findMany({ where: { organizationId, slug: { notIn: SKIP_SLUGS } }, include: { items: true } });
  const existing = new Set((await prod.collection.findMany({ where: { id: { in: mine.map((c) => c.id) } }, select: { id: true } })).map((c) => c.id));
  return mine.filter((c) => !existing.has(c.id));
}

/** Local sections paired with the prod section of the same type and title, if prod has one */
async function layoutPlan(organizationId: string) {
  const [mine, theirs] = await Promise.all([
    local.homeSection.findMany({ where: { organizationId }, include: { items: true }, orderBy: { sortOrder: "asc" } }),
    prod.homeSection.findMany({ where: { organizationId }, select: { id: true, type: true, title: true } }),
  ]);
  const free = [...theirs];
  return mine.map((section) => {
    const i = free.findIndex((p) => p.type === section.type && (p.title ?? null) === (section.title ?? null));
    const match = i === -1 ? null : free.splice(i, 1)[0];
    return { section, prodId: match?.id ?? null };
  });
}

async function campaignRows() {
  const campaigns = await local.brandCampaign.findMany({ where: { title: { in: CAMPAIGNS }, status: "LIVE" }, include: { banner: true, product: { select: { code: true } } } });
  const existing = new Set((await prod.brandCampaign.findMany({ where: { id: { in: campaigns.map((c) => c.id) } }, select: { id: true } })).map((c) => c.id));
  return campaigns.filter((c) => !existing.has(c.id));
}

async function writeCollections(tx: Prisma.TransactionClient, collections: Awaited<ReturnType<typeof newCollections>>) {
  for (const { items, ...c } of collections) {
    await tx.collection.create({ data: { ...c, translations: json(c.translations), heroTheme: json(c.heroTheme) } as Prisma.CollectionUncheckedCreateInput });
    await tx.collectionItem.createMany({ data: items, skipDuplicates: true });
  }
}

async function writeLayout(tx: Prisma.TransactionClient, plan: Awaited<ReturnType<typeof layoutPlan>>) {
  for (const { section: { items, ...s }, prodId } of plan) {
    const data = { sortOrder: s.sortOrder, config: json(s.config), subtitle: s.subtitle, translations: json(s.translations), collectionId: s.collectionId, isActive: s.isActive };
    const id = prodId ?? s.id;
    if (prodId) await tx.homeSection.update({ where: { id: prodId }, data });
    else await tx.homeSection.create({ data: { ...data, id: s.id, organizationId: s.organizationId, type: s.type, title: s.title } });
    if (items.length && !(await tx.homeSectionItem.count({ where: { sectionId: id } }))) {
      await tx.homeSectionItem.createMany({ data: items.map((item) => ({ ...item, sectionId: id, translations: json(item.translations) })) });
    }
  }
}

async function writeAds(tx: Prisma.TransactionClient, campaigns: Awaited<ReturnType<typeof campaignRows>>) {
  const owner = await tx.user.findFirstOrThrow({ where: { email: "demo@martly.in" }, select: { id: true } });
  for (const { banner, product, ...c } of campaigns) {
    const adProduct = await tx.adProduct.findUniqueOrThrow({ where: { code: product.code }, select: { id: true } });
    await tx.brandCampaign.create({ data: { ...c, productId: adProduct.id, createdById: owner.id, adOrderId: null } });
    if (banner) await tx.banner.create({ data: { ...banner, imageUrls: json(banner.imageUrls), viewsServed: 0 } as Prisma.BannerUncheckedCreateInput });
  }
}

async function main() {
  const org = await local.organization.findFirstOrThrow({ where: { name: ORG_NAME }, select: { id: true } });
  const collections = await newCollections(org.id);
  const plan = await layoutPlan(org.id);
  const coupons = await local.coupon.findMany({ where: { code: { in: COUPONS } } });
  const known = new Set((await prod.coupon.findMany({ where: { code: { in: COUPONS } }, select: { code: true } })).map((c) => c.code));
  const campaigns = await campaignRows();
  console.log(`Collections to insert: ${collections.length} (${collections.map((c) => c.slug).join(", ")})`);
  console.log(`Layout: ${plan.filter((p) => p.prodId).length} prod sections updated in place, ${plan.filter((p) => !p.prodId).length} inserted`);
  console.log(`Coupons to insert: ${coupons.filter((c) => !known.has(c.code)).map((c) => c.code).join(", ") || "none"}`);
  console.log(`Brand campaigns to insert: ${campaigns.map((c) => c.title).join(", ") || "none"}`);
  if (!apply) return console.log("Dry run; pass --apply to write to prod");
  await prod.$transaction(async (tx) => {
    await writeCollections(tx, collections);
    await writeLayout(tx, plan);
    await tx.coupon.createMany({ data: coupons.filter((c) => !known.has(c.code)).map((c) => ({ ...c, usedCount: 0 })), skipDuplicates: true });
    await writeAds(tx, campaigns);
  }, { timeout: 120_000 });
  console.log("Prod updated");
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => Promise.all([local.$disconnect(), prod.$disconnect()]));
