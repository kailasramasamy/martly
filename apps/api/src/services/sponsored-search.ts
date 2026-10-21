import { createHash } from "crypto";
import { normalizeQuery } from "./search.js";
import { istDateKey } from "./ist-day.js";
import type { SponsoredAd } from "./sponsored.js";

type Row = { productId: string; product: { brandId: string | null } };
type Sponsored<T> = T & { sponsored?: { bannerId: string } };

// Search results carry ads at product positions 1 and 6
const SEARCH_SLOTS = [0, 5];
// An ad's product must already rank this high for the query, so a stray description match never earns a slot
const MAX_AD_RANK = 40;

const cleanBrand = (name: string) => normalizeQuery(name.replace(/\s*\([^)]*\)/g, ""));

/**
 * The query names a brand ("surf", "aachi chilli", "sak"): the shopper has chosen, so no ad competes with that brand.
 */
export function namesBrand(query: string, brandNames: string[]) {
  const q = normalizeQuery(query);
  return brandNames.some((name) => {
    const brand = cleanBrand(name);
    return brand.length > 0 && (q.startsWith(brand) || (q.length >= 3 && brand.startsWith(q)));
  });
}

/** Live ads in a fixed order for this seed (query and day), so bookings share slots without reshuffling on scroll */
export function rotateAds(ads: SponsoredAd[], seed: string) {
  if (ads.length < 2) return ads;
  const start = createHash("sha1").update(`${seed}:${istDateKey(new Date())}`).digest().readUInt32BE(0) % ads.length;
  return [...ads.slice(start), ...ads.slice(0, start)];
}

/** Ads whose product sits in these ranked product ids, one per brand, best rotation first */
function eligibleAds(ads: SponsoredAd[], rankedIds: string[], brandOf: Map<string, string | null>, seed: string, max: number) {
  const top = new Set(rankedIds.slice(0, MAX_AD_RANK));
  const brands = new Set<string>();
  const picked: SponsoredAd[] = [];
  for (const ad of rotateAds(ads.filter((a) => top.has(a.productId)), seed)) {
    const brand = brandOf.get(ad.productId);
    if (brand && brands.has(brand)) continue;
    if (brand) brands.add(brand);
    picked.push(ad);
    if (picked.length === max) break;
  }
  return picked;
}

function groupByProduct<T extends Row>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.productId, [...(groups.get(row.productId) ?? []), row]);
  return [...groups.values()];
}

const markSponsored = <T>(rows: T[], ad: SponsoredAd): Sponsored<T>[] => rows.map((r) => ({ ...r, sponsored: { bannerId: ad.bannerId } }));

/**
 * Moves up to two sponsored products that matched the search into slots 1 and 6 (out of their organic place), marked
 * as ads. Rows are a product's sizes, kept together.
 */
export function placeSearchAds<T extends Row>(rows: T[], ads: SponsoredAd[], query: string): Sponsored<T>[] {
  const groups = groupByProduct(rows);
  const brandOf = new Map(rows.map((r) => [r.productId, r.product.brandId]));
  const picked = eligibleAds(ads, groups.map((g) => g[0].productId), brandOf, normalizeQuery(query), SEARCH_SLOTS.length);
  if (picked.length === 0) return rows;
  const adIds = new Set(picked.map((a) => a.productId));
  const placed: Sponsored<T>[][] = groups.filter((g) => !adIds.has(g[0].productId));
  picked.forEach((ad, i) => {
    const group = groups.find((g) => g[0].productId === ad.productId)!;
    placed.splice(Math.min(SEARCH_SLOTS[i], placed.length), 0, markSponsored(group, ad));
  });
  return placed.flat();
}

/**
 * The sponsored product among a cart-builder line's options (in search order), moved to the front and marked. Picking
 * still ranks a brand the customer named or bought before above it, and it's never added for them.
 */
export function sponsorLine<T extends Row>(groups: T[][], ads: SponsoredAd[], seed: string): Sponsored<T>[][] {
  const brandOf = new Map(groups.map((g) => [g[0].productId, g[0].product.brandId]));
  const [ad] = eligibleAds(ads, groups.map((g) => g[0].productId), brandOf, normalizeQuery(seed), 1);
  if (!ad) return groups;
  const group = groups.find((g) => g[0].productId === ad.productId)!;
  return [markSponsored(group, ad), ...groups.filter((g) => g !== group)];
}
