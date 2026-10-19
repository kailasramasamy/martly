import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { api, ApiError } from "../../lib/api";
import { useCart } from "../../lib/cart-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useToast } from "../../lib/toast-context";
import type { OrderSummary, ReorderItems } from "./types";

/** Puts a past order back in the cart at today's prices, asking first when the cart holds another store's items */
export function useReorder() {
  const router = useRouter();
  const toast = useToast();
  const { storeId: cartStoreId, addItems } = useCart();
  const { isMember } = useMembership();
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [pending, setPending] = useState<ReorderItems | null>(null);

  const apply = useCallback((data: ReorderItems) => {
    addItems(data.store.id, data.store.name, data.items.map(({ storeProduct: sp, quantity }) => ({
      storeProductId: sp.id,
      productId: sp.product.id,
      productName: sp.product.name,
      variantId: sp.variant.id,
      variantName: sp.variant.name,
      price: getBestPrice(sp, isMember),
      imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl ?? null,
      quantity,
    })));
    const added = data.items.length;
    const missing = data.unavailable.length;
    toast.show(
      missing ? `${added} item${added !== 1 ? "s" : ""} added · ${missing} not available now` : `${added} item${added !== 1 ? "s" : ""} added to cart`,
      missing ? "info" : "success",
    );
    router.push("/(tabs)/cart");
  }, [addItems, isMember, toast, router]);

  const reorder = useCallback(async (order: OrderSummary) => {
    setReorderingId(order.id);
    try {
      const { data } = await api.get<ReorderItems>(`/api/v1/orders/${order.id}/reorder-items`);
      if (data.items.length === 0) toast.show("None of these items are available right now", "error");
      else if (cartStoreId && cartStoreId !== data.store.id) setPending(data);
      else apply(data);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Couldn't load this order. Check your connection.", "error");
    } finally {
      setReorderingId(null);
    }
  }, [cartStoreId, apply, toast]);

  const confirmReplace = useCallback(() => {
    if (pending) apply(pending);
    setPending(null);
  }, [pending, apply]);

  return { reorderingId, reorder, pending, confirmReplace, dismissReplace: () => setPending(null) };
}
