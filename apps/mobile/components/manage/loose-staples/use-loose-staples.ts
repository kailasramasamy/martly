import { useMemo, useState } from "react";
import type { LooseStapleAisle, LooseStapleItem } from "@martly/shared/types";
import { api } from "../../../lib/api";
import { toQuery } from "../../../lib/manage/query";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";

export type StapleFilter = "TO_PRICE" | "LISTED" | "ALL";
export type Drafts = Record<string, string>;

const BASE = "/api/v1/loose-staples";
const DEFAULT_OPENING_STOCK = "20";

const priceOf = (text: string | undefined) => (text && /^\d+(\.\d{1,2})?$/.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

/** A draft that would change something: a price for an unlisted size, or a new price for a listed one */
export function draftChange(item: LooseStapleItem, drafts: Drafts) {
  const price = priceOf(drafts[item.variantId]);
  return price !== null && (!item.listed || item.listed.price !== price || !item.listed.isActive) ? price : null;
}

const matches = (item: LooseStapleItem, filter: StapleFilter, q: string) =>
  (filter === "ALL" || (filter === "LISTED") === !!item.listed) && (!q || item.name.toLowerCase().includes(q));

/** Aisles narrowed to the tab and search, keeping only aisles with something left to show */
export function visibleAisles(aisles: LooseStapleAisle[], filter: StapleFilter, query: string) {
  const q = query.trim().toLowerCase();
  return aisles
    .map((a) => ({ ...a, id: a.subcategoryId, items: a.items.filter((i) => matches(i, filter, q)) }))
    .filter((a) => a.items.length > 0);
}

/** The store's loose staples with the owner's draft prices, filled from suggestions or typed, saved in one go */
export function useLooseStaples(storeId: string | null) {
  const res = useResource<LooseStapleAisle[]>(storeId ? `${BASE}${toQuery({ storeId })}` : null);
  const { run, running } = useAction();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [openingStock, setOpeningStock] = useState(DEFAULT_OPENING_STOCK);
  const all = useMemo(() => (res.data ?? []).flatMap((a) => a.items), [res.data]);
  const changes = all.flatMap((i) => { const price = draftChange(i, drafts); return price === null ? [] : [{ variantId: i.variantId, price }]; });

  const setPrice = (variantId: string, text: string) => setDrafts((d) => ({ ...d, [variantId]: text.replace(/[^\d.]/g, "") }));
  // Suggestions fill sizes the store doesn't sell yet; a price the owner typed is kept
  const fillSuggested = (items: LooseStapleItem[]) => setDrafts((d) => ({
    ...Object.fromEntries(items.filter((i) => !i.listed && i.suggested !== null).map((i) => [i.variantId, String(i.suggested)])), ...d,
  }));

  const save = async () => {
    if (!storeId || changes.length === 0) return;
    const stock = Number.parseInt(openingStock, 10);
    const result = await run(
      () => api.put<{ listed: number; repriced: number }>(BASE, { storeId, openingStock: Number.isNaN(stock) ? 0 : stock, items: changes }),
      `Saved ${changes.length} ${changes.length === 1 ? "price" : "prices"}`,
    );
    if (!result) return;
    setDrafts({});
    await res.reload();
  };

  return { ...res, all, drafts, setPrice, fillSuggested, changes, openingStock, setOpeningStock, save, running };
}
