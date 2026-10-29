/**
 * Onboards a store from a spec, the way Admin → Onboard store does: organisation, store, owner, the shared role logins,
 * the logo and the organisation's own brand, catalog, storefront copy, readiness, launch. Steps already done are skipped,
 * so a failed run is fixed and run again. Logins and passwords are saved in `<spec>.logins.json` (reused on re-runs).
 *
 * Usage: cd apps/api && npx tsx scripts/onboard-store.ts <spec.json> [--prod]
 * The /onboard-store skill (.claude/skills/onboard-store) writes the spec; defaults are Sree Ranga Store's.
 */

import dotenv from "dotenv";
dotenv.config({ override: true });

import { existsSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient, type Prisma, type Store } from "../generated/prisma/client.js";
import { HeroCardPalette, StoreSize, URL_SEGMENT_RULE } from "@martly/shared/constants";
import { STOREFRONT_PARTS, createOnboardingSchema, parseHomeSectionConfig } from "@martly/shared/schemas";
import { createOnboarding, regionOf, updateOnboarding } from "../src/services/onboarding/create.js";
import { applyCatalog } from "../src/services/onboarding/catalog-apply.js";
import { copyStorefront } from "../src/services/onboarding/storefront-copy.js";
import { readiness } from "../src/services/onboarding/readiness.js";
import { assertEmailFree } from "../src/services/onboarding/owner.js";
import { cleanLogo } from "../src/services/brand-logo.js";
import { uniqueBrandSlug } from "../src/services/brands.js";
import { putObject } from "../src/services/media.js";
import { launchStore } from "../src/services/onboarding/launch.js";
import { draftCollection } from "../src/services/collection-ai-draft.js";

const LOGIN_DOMAIN = "martlyshop.in";
const TEAM = [
  { role: "STORE_MANAGER", suffix: "manager", label: "Manager" },
  { role: "STAFF", suffix: "staff", label: "Staff" },
  { role: "RIDER", suffix: "rider", label: "Rider" },
] as const;

const specSchema = z.object({
  organizationName: z.string().trim().min(2),
  storeName: z.string().trim().min(2),
  slug: z.string().regex(URL_SEGMENT_RULE.pattern, URL_SEGMENT_RULE.message),
  townSlug: z.string(),
  size: z.nativeEnum(StoreSize),
  address: z.string().trim().min(5),
  phone: z.string().regex(/^\d{10}$/),
  latitude: z.number(),
  longitude: z.number(),
  owner: z.object({ name: z.string().trim().min(2), phone: z.string().regex(/^\d{10}$/) }),
  /** The owner's phone is a shopper account, and the user agreed to turn it into the owner's login */
  upgradeShopper: z.boolean().default(false),
  /** The organisation's own brand, for the store's own packs */
  brandName: z.string().trim().min(1).optional(),
  /** Local logo file; an opaque background is removed (Photoroom) */
  logoPath: z.string().optional(),
  delivery: z.object({
    radius: z.number().default(5),
    minOrderAmount: z.number().default(99),
    freeDeliveryThreshold: z.number().nullable().default(299),
    startingDeliveryFee: z.number().default(20),
    expressEtaMinutes: z.number().int().default(30),
    opensAt: z.string().default("07:00"),
    closesAt: z.string().default("21:30"),
    /** Express delivery within the ETA, during opening hours */
    express: z.boolean().default(true),
    /** Scheduled delivery slots, copied from the template store */
    slots: z.boolean().default(true),
  }).default({}),
  catalog: z.object({
    discountPct: z.number().default(0),
    openingStock: z.number().int().default(50),
    /** Department, category or aisle names the store doesn't sell, e.g. "Meat, Fish & Eggs" */
    exclude: z.array(z.string()).default([]),
    /** Products per aisle visible at launch; the rest are hidden suggestions. Defaults by store size */
    likelyPerAisle: z.number().int().min(0).optional(),
  }).default({}),
  /** Collections the AI curator builds from these briefs, each a Home hero card in its palette */
  heroCollections: z.array(z.object({ brief: z.string().min(3).max(300), palette: z.nativeEnum(HeroCardPalette) })).default([]),
  launch: z.boolean().default(true),
});
type Spec = z.infer<typeof specSchema>;
type Logins = Record<string, { email: string; password: string }>;

const [specPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const prod = process.argv.includes("--prod");
if (!specPath) throw new Error("Usage: npx tsx scripts/onboard-store.ts <spec.json> [--prod]");
const prisma = new PrismaClient(prod ? { datasourceUrl: process.env.PROD_DATABASE_URL } : undefined);
const loginsPath = specPath.replace(/\.json$/, "") + ".logins.json";

const password = () => randomBytes(9).toString("base64url");
const step = (msg: string) => console.log(`• ${msg}`);

function loadLogins(slug: string): Logins {
  const saved: Logins = existsSync(loginsPath) ? JSON.parse(readFileSync(loginsPath, "utf8")) : {};
  const roles = ["owner", ...TEAM.map((t) => t.suffix)];
  for (const r of roles) {
    saved[r] ??= { email: `${slug}${r === "owner" ? "" : `-${r}`}@${LOGIN_DOMAIN}`, password: password() };
  }
  writeFileSync(loginsPath, JSON.stringify(saved, null, 2));
  return saved;
}

async function ensureStore(spec: Spec, townId: string, logins: Logins): Promise<Store> {
  const existing = await prisma.store.findFirst({ where: { townId, slug: spec.slug } });
  if (existing) {
    step(`Store ${spec.slug} exists (${existing.status}), continuing`);
    return existing;
  }
  const d = spec.delivery;
  const created = await createOnboarding(prisma, createOnboardingSchema.parse({
    organizationName: spec.organizationName,
    owner: { ...spec.owner, ...logins.owner },
    upgradeShopper: spec.upgradeShopper,
    store: {
      name: spec.storeName, address: spec.address, townId, phone: spec.phone,
      latitude: spec.latitude, longitude: spec.longitude,
      deliveryRadius: d.radius, minOrderAmount: d.minOrderAmount, freeDeliveryThreshold: d.freeDeliveryThreshold,
      startingDeliveryFee: d.startingDeliveryFee, expressEtaMinutes: d.expressEtaMinutes, opensAt: d.opensAt, closesAt: d.closesAt,
    },
  }));
  await updateOnboarding(prisma, created.id, { size: spec.size });
  step(`Created ${spec.organizationName} / ${spec.storeName}`);
  return prisma.store.update({ where: { id: created.id }, data: { slug: spec.slug } });
}

/** Store logo and the organisation's own brand share the cleaned logo and its colour */
async function ensureLogoAndBrand(spec: Spec, store: Store) {
  let { logoUrl, brandColor } = store;
  if (!logoUrl && spec.logoPath) {
    const logo = await cleanLogo(readFileSync(spec.logoPath.replace(/^~/, process.env.HOME!)), true);
    logoUrl = (await putObject(`stores/${spec.slug}-${Date.now().toString(36)}.webp`, logo.image, "image/webp")).url;
    brandColor = logo.themeColor;
    await prisma.store.update({ where: { id: store.id }, data: { logoUrl, brandColor } });
    step(`Logo uploaded (background ${logo.background}, colour ${brandColor}): ${logoUrl}`);
  }
  if (!spec.brandName) return;
  const brand = await prisma.brand.findFirst({ where: { organizationId: store.organizationId, name: spec.brandName } });
  if (brand) return step(`Brand ${spec.brandName} exists`);
  await prisma.brand.create({
    data: {
      name: spec.brandName, slug: await uniqueBrandSlug(prisma, spec.brandName),
      organizationId: store.organizationId, imageUrl: logoUrl, themeColor: brandColor,
      regions: regionOf(store.state) ? [regionOf(store.state)!] : [],
    },
  });
  step(`Created brand ${spec.brandName}`);
}

/** One shared login per role at the store, email + password, no phone (staff sign in from the app's Staff Sign In) */
async function ensureTeam(spec: Spec, store: Store, logins: Logins) {
  for (const t of TEAM) {
    const { email, password: pw } = logins[t.suffix];
    if (await prisma.user.findUnique({ where: { email } })) continue;
    await prisma.$transaction(async (tx) => {
      await assertEmailFree(tx, email);
      const user = await tx.user.create({
        data: { email, name: `${spec.storeName} ${t.label}`, role: t.role, passwordHash: await bcrypt.hash(pw, 10) },
      });
      await tx.userStore.create({ data: { userId: user.id, storeId: store.id, role: t.role } });
    });
    step(`Added ${email}`);
  }
}

/** Every aisle under the named departments, categories or aisles; an unknown name stops the run */
async function excludedAisles(names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const rows = await prisma.subcategory.findMany({
      where: { OR: [{ name }, { category: { name } }, { category: { department: { name } } }] },
      select: { id: true },
    });
    if (!rows.length) throw new Error(`No department, category or aisle named "${name}"`);
    ids.push(...rows.map((r) => r.id));
  }
  return ids;
}

async function setUpShelves(spec: Spec, store: Store) {
  const sized = { id: store.id, state: store.state, size: spec.size };
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  const excludedSubcategoryIds = await excludedAisles(spec.catalog.exclude);
  const result = await applyCatalog(prisma, sized, {
    excludedSubcategoryIds, includedSubcategoryIds: [], excludedBrandIds: [], includedBrandIds: [],
    discountPct: spec.catalog.discountPct, openingStock: spec.catalog.openingStock, likelyPerAisle: spec.catalog.likelyPerAisle,
  }, admin.id);
  step(`Catalog: ${result.created} listed, ${result.kept} kept, ${result.removed} removed, ${result.needsPrice} need a price (${excludedSubcategoryIds.length} aisles left out)`);

  if (await prisma.homeSection.count({ where: { organizationId: store.organizationId } })) return step("Storefront already copied");
  const template = await prisma.organization.findFirstOrThrow({ where: { isTemplate: true }, orderBy: { name: "asc" } });
  const parts = STOREFRONT_PARTS.filter((p) => p !== "deliverySlots" || spec.delivery.slots);
  const copy = await copyStorefront(prisma, store, { templateOrganizationId: template.id, parts });
  step(`Storefront copied from ${template.name}: ${JSON.stringify(copy)}`);
}

async function applyDeliveryModes(spec: Spec, store: Store) {
  await prisma.expressDeliveryConfig.update({ where: { storeId: store.id }, data: { isEnabled: spec.delivery.express } });
  if (!spec.delivery.slots) await prisma.deliverySlot.updateMany({ where: { storeId: store.id }, data: { isActive: false } });
  step(`Delivery: express ${spec.delivery.express ? "on" : "off"}, slots ${spec.delivery.slots ? "on" : "off"}`);
}

type HeroConfig = { cards: { kind: string; collectionId?: string; palette?: string }[] };

/** Briefs past the collection cards the carousel already has become AI collections, each added as a card */
async function ensureHeroCollections(spec: Spec, store: Store) {
  const section = await prisma.homeSection.findFirst({ where: { organizationId: store.organizationId, type: "HERO_CARDS" } });
  if (!section) throw new Error("No hero carousel on Home; copy the storefront first");
  const config = section.config as HeroConfig;
  const done = config.cards.filter((c) => c.kind === "COLLECTION").length;
  for (const { brief, palette } of spec.heroCollections.slice(done)) {
    const draft = await draftCollection(prisma, store.organizationId, brief, "STANDARD");
    if (typeof draft === "string") throw new Error(`Hero collection "${brief}": ${draft}`);
    const last = await prisma.collection.findFirst({ where: { organizationId: store.organizationId }, orderBy: { sortOrder: "desc" } });
    const collection = await prisma.collection.create({
      data: {
        title: draft.title, subtitle: draft.subtitle, slug: draft.slug, organizationId: store.organizationId,
        artDirection: draft.artDirection, sortOrder: (last?.sortOrder ?? 0) + 1,
        translations: { ta: { title: draft.titleTa, subtitle: draft.subtitleTa } },
        items: { create: draft.products.map((p, i) => ({ productId: p.id, sortOrder: i })) },
      },
    });
    config.cards.push({ kind: "COLLECTION", collectionId: collection.id, palette });
    await prisma.homeSection.update({ where: { id: section.id }, data: { config: parseHomeSectionConfig("HERO_CARDS", config) as Prisma.InputJsonValue } });
    step(`Hero collection "${draft.title}" / ${draft.titleTa}: ${draft.products.map((p) => p.name).join(", ")}`);
  }
}

async function checkAndLaunch(spec: Spec, store: Store) {
  const checks = await readiness(prisma, store.id);
  for (const c of checks) console.log(`  ${c.ok ? "✓" : c.required ? "✗" : "–"} ${c.label}${c.detail ? ` (${c.detail})` : ""}`);
  const blocking = checks.filter((c) => c.required && !c.ok);
  if (store.status !== "PENDING" || !spec.launch) return;
  if (blocking.length) throw new Error(`Not launched: ${blocking.map((c) => c.label).join(", ")}`);
  await launchStore(prisma, store.id);
  step("Launched, with 90 days of Growth on a first launch");
}

async function main() {
  const spec = specSchema.parse(JSON.parse(readFileSync(specPath, "utf8")));
  console.log(`${prod ? "PROD" : "local"}: onboarding ${spec.storeName}`);
  const town = await prisma.town.findUniqueOrThrow({ where: { slug: spec.townSlug } });
  const logins = loadLogins(spec.slug);
  const store = await ensureStore(spec, town.id, logins);
  await ensureLogoAndBrand(spec, store);
  await ensureTeam(spec, store, logins);
  await applyDeliveryModes(spec, store);
  if (store.status === "PENDING") await setUpShelves(spec, await prisma.store.findUniqueOrThrow({ where: { id: store.id } }));
  await checkAndLaunch(spec, store);
  // The curator draws on live stores' shelves, so hero collections come once the store is launched
  if ((await prisma.store.findUniqueOrThrow({ where: { id: store.id } })).status === "ACTIVE") await ensureHeroCollections(spec, store);
  console.log(`\nStore ${store.id}: https://www.martlyshop.in/${town.slug}/${spec.slug}`);
  for (const [role, l] of Object.entries(logins)) console.log(`  ${role.padEnd(8)} ${l.email}  ${l.password}`);
  console.log(`Logins saved in ${loginsPath}`);
}

await main().finally(() => prisma.$disconnect());
