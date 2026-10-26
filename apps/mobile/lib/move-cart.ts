import { useCallback } from "react";
import { api } from "./api";
import { toCartItem, useCart, type CartItem, type CartStore } from "./cart-context";
import { useMembership } from "./membership-context";
import { useLanguage } from "./language-context";
import { useToast } from "./toast-context";
import { useStrings } from "./i18n/use-strings";
import type { CartTransfer } from "@martly/shared/types";
import type { StoreProduct } from "./types";

function withLines(cart: CartItem[], adding: CartItem[]) {
  const next = [...cart];
  for (const line of adding) {
    const at = next.findIndex((i) => i.storeProductId === line.storeProductId);
    if (at >= 0) next[at] = { ...next[at], quantity: next[at].quantity + line.quantity };
    else next.push(line);
  }
  return next;
}

/**
 * Moves a cart with items to another store at that store's prices, with any lines being added there, in one step.
 * A toast says what the store doesn't sell, with an undo that puts the old cart back (and runs onUndo).
 */
export function useMoveCart() {
  const { store: from, items, replaceCart } = useCart();
  const { isMember } = useMembership();
  const { getLocalizedName } = useLanguage();
  const toast = useToast();
  const t = useStrings("cart");

  return useCallback(async (to: CartStore, adding: CartItem[] = [], onUndo?: () => void) => {
    if (!from || from.id === to.id || items.length === 0) return;
    const lines = items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }));
    const res = await api.post<CartTransfer<StoreProduct>>("/api/v1/cart/transfer", { toStoreId: to.id, lines }).catch(() => null);
    if (!res) {
      toast.show(t.moveFailed, "error");
      return;
    }
    const { moved, missing } = res.data;
    replaceCart(to, withLines(moved.map((sp) => toCartItem(sp, sp.quantity, isMember)), adding));
    const name = getLocalizedName(to);
    const undo = () => { replaceCart(from, items); onUndo?.(); };
    toast.show(missing.length ? t.movedMissing(missing.length, name) : t.movedTo(name), missing.length ? "info" : "success", [{ label: t.undo, onPress: undo }]);
  }, [from, items, replaceCart, isMember, getLocalizedName, toast, t]);
}
