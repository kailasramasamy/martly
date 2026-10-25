import { useCallback, useMemo, useState } from "react";
import { router } from "expo-router";
import { lineTotal } from "@martly/shared/offers";
import { toCartItem, useCart } from "../../lib/cart-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useStore } from "../../lib/store-context";
import type { MonthlyList, MonthlyListCheck, StoreProduct } from "../../lib/types";

export type Verdict = "yes" | "no";
export type OrderLine = { sp: StoreProduct; quantity: number };

/** A check's key, stable across reloads of the list */
export const checkKey = (c: MonthlyListCheck) => (c.kind === "NEW_USUAL" ? `${c.kind}:${c.product.id}` : `${c.kind}:${c.itemId}`);

/**
 * This month's choices on top of the saved list: lines left out, swaps for an item that's out, and checks
 * already answered. None of it changes the list for later months.
 */
export function useMonthPlan(list: MonthlyList | null) {
  const { isMember } = useMembership();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [swaps, setSwaps] = useState<Map<string, StoreProduct>>(new Map());
  const [verdicts, setVerdicts] = useState<Map<string, Verdict>>(new Map());

  const toggle = useCallback((itemId: string) => setSkipped((prev) => {
    const next = new Set(prev);
    if (!next.delete(itemId)) next.add(itemId);
    return next;
  }), []);
  const settle = useCallback((check: MonthlyListCheck, verdict: Verdict) =>
    setVerdicts((prev) => new Map(prev).set(checkKey(check), verdict)), []);
  const swapFor = useCallback((itemId: string, sp: StoreProduct) => setSwaps((prev) => new Map(prev).set(itemId, sp)), []);
  const leaveOut = useCallback((itemId: string) => setSkipped((prev) => new Set(prev).add(itemId)), []);

  const lines = useMemo<OrderLine[]>(() => (list?.items ?? []).flatMap((item) => {
    if (skipped.has(item.id)) return [];
    const sp = swaps.get(item.id) ?? item.listing;
    return sp && sp.availableStock >= item.quantity ? [{ sp, quantity: item.quantity }] : [];
  }), [list, skipped, swaps]);
  const total = lines.reduce((sum, l) => sum + lineTotal(getBestPrice(l.sp, isMember), l.quantity, l.sp.pricing?.offer), 0);
  const open = (list?.changes ?? []).filter((c) => !verdicts.has(checkKey(c)));

  return { skipped, swaps, verdicts, toggle, settle, swapFor, leaveOut, lines, total, open };
}

/** Puts this month's lines in the cart (lines already there take the list's quantity) and opens checkout for the list */
export function useCheckoutHandoff(listId: string | undefined, lines: OrderLine[]) {
  const { selectedStore } = useStore();
  const { items, addItems, updateQuantity } = useCart();
  const { isMember } = useMembership();
  return useCallback(() => {
    if (!selectedStore || !listId) return;
    const inCart = new Set(items.map((i) => i.storeProductId));
    for (const l of lines) if (inCart.has(l.sp.id)) updateQuantity(l.sp.id, l.quantity);
    const fresh = lines.filter((l) => !inCart.has(l.sp.id)).map((l) => toCartItem(l.sp, l.quantity, isMember));
    addItems({ id: selectedStore.id, name: selectedStore.name, translations: selectedStore.translations }, fresh);
    router.push({ pathname: "/checkout", params: { monthlyListId: listId } });
  }, [selectedStore, listId, items, lines, isMember, addItems, updateQuantity]);
}
