import type { LooseStapleAisle, LooseStapleItem } from "@martly/shared/types";

export type StapleFilter = "TO_PRICE" | "LISTED" | "ALL";
export type Drafts = Record<string, string>;

export const DEFAULT_OPENING_STOCK = "20";

const priceOf = (text: string | undefined) => (text && /^\d+(\.\d{1,2})?$/.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

/** A draft that would change something: a price for an unlisted size, or a new price for a listed one */
export function draftChange(item: LooseStapleItem, drafts: Drafts) {
  const price = priceOf(drafts[item.variantId]);
  return price !== null && (!item.listed || item.listed.price !== price || !item.listed.isActive) ? price : null;
}

export const changesOf = (items: LooseStapleItem[], drafts: Drafts) =>
  items.flatMap((i) => {
    const price = draftChange(i, drafts);
    return price === null ? [] : [{ variantId: i.variantId, price }];
  });

const matches = (item: LooseStapleItem, filter: StapleFilter, q: string) =>
  (filter === "ALL" || (filter === "LISTED") === !!item.listed) && (!q || item.name.toLowerCase().includes(q));

/** Aisles narrowed to the tab and search, keeping only aisles with something left to show */
export function visibleAisles(aisles: LooseStapleAisle[], filter: StapleFilter, query: string) {
  const q = query.trim().toLowerCase();
  return aisles.map((a) => ({ ...a, items: a.items.filter((i) => matches(i, filter, q)) })).filter((a) => a.items.length > 0);
}

/** Suggestions fill sizes the store doesn't sell yet; a price already typed is kept */
export const withSuggestions = (items: LooseStapleItem[], drafts: Drafts): Drafts => ({
  ...Object.fromEntries(items.filter((i) => !i.listed && i.suggested !== null).map((i) => [i.variantId, String(i.suggested)])),
  ...drafts,
});
