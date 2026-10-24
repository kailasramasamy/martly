import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { api, ApiError } from "../../lib/api";
import { toCartItem, useCart } from "../../lib/cart-context";
import { useMembership } from "../../lib/membership-context";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { ReorderItems } from "./types";

/**
 * Buy again from a past order: loads its items at today's prices for the shopper to pick from, then adds the picked
 * ones to the cart, asking first when the cart holds another store's items
 */
export function useReorder() {
  const router = useRouter();
  const toast = useToast();
  const t = useStrings("orders").reorder;
  const { storeId: cartStoreId, addItems } = useCart();
  const { isMember } = useMembership();
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [pending, setPending] = useState<ReorderItems | null>(null);
  const [choices, setChoices] = useState<ReorderItems | null>(null);

  const apply = useCallback((data: ReorderItems) => {
    addItems(data.store, data.items.map(({ storeProduct: sp, quantity }) => toCartItem(sp, quantity, isMember)));
    toast.show(t.added(data.items.length), "success");
    router.push("/(tabs)/cart");
  }, [addItems, isMember, toast, router, t]);

  const reorder = useCallback(async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const { data } = await api.get<ReorderItems>(`/api/v1/orders/${orderId}/reorder-items`);
      if (data.items.length === 0) toast.show(t.noneAvailable, "error");
      else setChoices(data);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : t.loadFailed, "error");
    } finally {
      setReorderingId(null);
    }
  }, [toast, t]);

  const addPicked = useCallback((picked: ReorderItems["items"]) => {
    if (!choices) return;
    const data = { ...choices, items: picked };
    setChoices(null);
    if (cartStoreId && cartStoreId !== data.store.id) setPending(data);
    else apply(data);
  }, [choices, cartStoreId, apply]);

  const confirmReplace = useCallback(() => {
    if (pending) apply(pending);
    setPending(null);
  }, [pending, apply]);

  return {
    reorderingId, reorder, choices, addPicked, closeChoices: () => setChoices(null),
    pending, confirmReplace, dismissReplace: () => setPending(null),
  };
}
