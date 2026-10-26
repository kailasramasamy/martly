import type { PrismaClient } from "../../../generated/prisma/client.js";
import { STORE_SIZE_RULES, type StoreSize } from "@martly/shared/constants";
import type { CatalogRules } from "@martly/shared/schemas";
import type { CatalogProposal, ProposalAisle, ProposalBrand, ProposalDepartment, ProposalProduct } from "@martly/shared/types";
import { loadCandidates, loadTaxonomy, type Candidate, type TaxonomyRow } from "./catalog-candidates.js";
import { suggestPrices } from "../loose-staples.js";
import { regionOf } from "./create.js";

// A brand from the store's own state outranks a national one this much better known, one that also sells there by less;
// loose staples rank like a well-known brand
const HOME_REGION_BOOST = 50;
const REGIONAL_BOOST = 20;
const LOOSE_SCORE = 50;
const SALES_BOOST_CAP = 30;
const FORCED = 1000;

interface Context {
  region: string | null;
  tiers: Set<string>;
  brandsPerAisle: number;
  productsPerAisle: number;
  rules: CatalogRules;
}

interface BrandGroup extends ProposalBrand { score: number; members: Candidate[] }

export interface AislePick { included: boolean; available: number; brands: ProposalBrand[]; picked: Candidate[]; candidates: Candidate[] }

const isRegional = (c: Candidate, region: string | null) =>
  !!region && !!c.brand && c.brand.regions.includes(region) && !c.brand.regions.includes("ALL");

/** Brand regions list the brand's home state first */
function regionalBoost(regions: string[], region: string | null) {
  if (!region || regions.includes("ALL") || !regions.includes(region)) return 0;
  return regions[0] === region ? HOME_REGION_BOOST : REGIONAL_BOOST;
}

function eligible(c: Candidate, ctx: Context) {
  if (!c.brand) return true;
  if (ctx.rules.includedBrandIds.includes(c.brand.id)) return true;
  if (ctx.rules.excludedBrandIds.includes(c.brand.id)) return false;
  const r = c.brand.regions;
  return r.length === 0 || r.includes("ALL") || (!!ctx.region && r.includes(ctx.region));
}

function groupByBrand(candidates: Candidate[], ctx: Context): BrandGroup[] {
  const groups = new Map<string, BrandGroup>();
  for (const c of candidates) {
    const key = c.brand?.id ?? "loose";
    const group = groups.get(key) ?? {
      id: c.brand?.id ?? null, name: c.brand?.name ?? "Loose & unbranded", regional: isRegional(c, ctx.region),
      products: 0, score: 0, members: [],
    };
    group.members.push(c);
    groups.set(key, group);
  }
  for (const g of groups.values()) {
    const base = g.id === null ? LOOSE_SCORE : g.members[0].brand!.popularity + regionalBoost(g.members[0].brand!.regions, ctx.region);
    const sold = g.members.reduce((n, m) => n + m.sold, 0);
    const forced = g.id && ctx.rules.includedBrandIds.includes(g.id) ? FORCED : 0;
    g.score = base + Math.min(SALES_BOOST_CAP, sold / 10) + forced;
    g.members.sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name));
    g.products = g.members.length;
  }
  return [...groups.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** The aisle's best brands for the region, then their best sellers taken in turn so one brand doesn't fill the shelf */
function pickAisle(subcategoryId: string, tier: string, candidates: Candidate[], ctx: Context): AislePick {
  const included = !ctx.rules.excludedSubcategoryIds.includes(subcategoryId)
    && (ctx.tiers.has(tier) || ctx.rules.includedSubcategoryIds.includes(subcategoryId));
  const kept = groupByBrand(candidates.filter((c) => eligible(c, ctx)), ctx).slice(0, ctx.brandsPerAisle);
  const picked: Candidate[] = [];
  for (let round = 0; picked.length < ctx.productsPerAisle; round++) {
    const next = kept.map((g) => g.members[round]).filter(Boolean);
    if (next.length === 0) break;
    picked.push(...next.slice(0, ctx.productsPerAisle - picked.length));
  }
  const brands = kept.map(({ id, name, regional }) => ({
    id, name, regional, products: picked.filter((p) => (p.brand?.id ?? null) === id).length,
  }));
  return { included, available: candidates.length, brands, picked, candidates };
}

/** The aisle's brands the pick left out, best first, so one can be added by hand */
function otherBrands(pick: AislePick, ctx: Context) {
  const kept = new Set(pick.brands.map((b) => b.id));
  return groupByBrand(pick.candidates, ctx).filter((g) => !kept.has(g.id)).map(({ id, name, regional, products, members }) => ({
    id, name, regional, products, eligible: eligible(members[0], ctx),
  }));
}

function toProduct(c: Candidate, region: string | null, listed: Set<string>): ProposalProduct {
  return {
    id: c.id, name: c.name, imageUrl: c.imageUrl,
    brand: c.brand ? { id: c.brand.id, name: c.brand.name, regional: isRegional(c, region) } : null,
    variants: c.variants.map((v) => ({ ...v, listed: listed.has(v.id) })),
  };
}

function buildTree(taxonomy: TaxonomyRow[], picks: Map<string, AislePick>): ProposalDepartment[] {
  const departments: ProposalDepartment[] = [];
  for (const row of taxonomy) {
    let dept = departments.at(-1);
    if (dept?.id !== row.department_id) departments.push(dept = { id: row.department_id, name: row.department, categories: [] });
    let cat = dept.categories.at(-1);
    if (cat?.id !== row.category_id) dept.categories.push(cat = { id: row.category_id, name: row.category, aisles: [] });
    const pick = picks.get(row.subcategory_id)!;
    const aisle: ProposalAisle = {
      id: row.subcategory_id, name: row.subcategory, tier: row.tier, included: pick.included, available: pick.available,
      products: pick.picked.length, variants: pick.picked.reduce((n, p) => n + p.variants.length, 0), brands: pick.brands,
    };
    cat.aisles.push(aisle);
  }
  return departments;
}

/** Every aisle's pick for the store's region and size under the given adjustments */
export async function proposeCatalog(prisma: PrismaClient, store: { id: string; state: string | null; size: StoreSize }, rules: CatalogRules) {
  const sizeRule = STORE_SIZE_RULES[store.size];
  const ctx: Context = {
    region: regionOf(store.state),
    tiers: new Set(sizeRule.tiers),
    brandsPerAisle: rules.brandsPerAisle ?? sizeRule.brandsPerAisle,
    productsPerAisle: rules.productsPerAisle ?? sizeRule.productsPerAisle,
    rules,
  };
  const [candidates, taxonomy] = await Promise.all([loadCandidates(prisma), loadTaxonomy(prisma)]);
  const bySubcategory = new Map<string, Candidate[]>();
  for (const c of candidates) bySubcategory.set(c.subcategoryId, [...(bySubcategory.get(c.subcategoryId) ?? []), c]);
  const picks = new Map(taxonomy.map((t) => [t.subcategory_id, pickAisle(t.subcategory_id, t.tier, bySubcategory.get(t.subcategory_id) ?? [], ctx)]));
  return { ctx, taxonomy, picks };
}

/** The sizes the proposal lists: MRP-priced ones are listed directly, the rest wait for a price */
export function proposedVariants(picks: Map<string, AislePick>) {
  return [...picks.values()].filter((p) => p.included).flatMap((p) => p.picked.flatMap((c) =>
    c.variants.map((v) => ({ productId: c.id, variantId: v.id, mrp: v.mrp }))));
}

/** The proposal as the wizard shows it, with one aisle's products when asked */
export async function catalogProposal(
  prisma: PrismaClient, store: { id: string; state: string | null; size: StoreSize }, rules: CatalogRules, subcategoryId?: string,
): Promise<CatalogProposal> {
  const { ctx, taxonomy, picks } = await proposeCatalog(prisma, store, rules);
  const listedRows = await prisma.storeProduct.findMany({ where: { storeId: store.id }, select: { variantId: true } });
  const listed = new Set(listedRows.map((r) => r.variantId));
  const variants = proposedVariants(picks);
  const loose = variants.filter((v) => v.mrp === null && !listed.has(v.variantId)).map((v) => v.variantId);
  const suggested = await suggestPrices(prisma, store.id, loose);
  const included = [...picks.values()].filter((p) => p.included && p.picked.length > 0);
  const brandIds = new Set(included.flatMap((p) => p.picked.map((c) => c.brand?.id ?? "loose")));
  const aisle = subcategoryId ? picks.get(subcategoryId) : undefined;
  return {
    region: ctx.region,
    size: store.size,
    brandsPerAisle: ctx.brandsPerAisle,
    productsPerAisle: ctx.productsPerAisle,
    totals: {
      aisles: included.length,
      brands: brandIds.size,
      products: included.reduce((n, p) => n + p.picked.length, 0),
      variants: variants.length,
      needsPrice: loose.filter((id) => !suggested.has(id)).length,
      listed: listed.size,
    },
    departments: buildTree(taxonomy, picks),
    ...(aisle ? { products: aisle.picked.map((c) => toProduct(c, ctx.region, listed)), otherBrands: otherBrands(aisle, ctx) } : {}),
  };
}
