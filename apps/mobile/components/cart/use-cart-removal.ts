import { useState } from "react";
import { useCart } from "../../lib/cart-context";
import { useLanguage } from "../../lib/language-context";
import { useToast } from "../../lib/toast-context";
import { useStrings } from "../../lib/i18n/use-strings";

/** Removing a line or clearing the cart is instant; Undo on the toast puts things back where they were */
export function useCartRemoval() {
  const t = useStrings("cart");
  const toast = useToast();
  const { getLocalizedName } = useLanguage();
  const { store, items, removeItem, clearCart, restoreItems } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);

  const removeAt = (index: number) => {
    const item = items[index];
    if (!store || !item) return;
    removeItem(item.storeProductId);
    const name = getLocalizedName({ name: item.productName, translations: item.translations });
    toast.show(t.removed(name), "default", { label: t.undo, onPress: () => restoreItems(store, [{ item, index }]) });
  };

  const clearAll = () => {
    if (!store) return;
    const removed = items.map((item, index) => ({ item, index }));
    clearCart();
    setConfirmClear(false);
    toast.show(t.cleared, "default", { label: t.undo, onPress: () => restoreItems(store, removed) });
  };

  return { removeAt, clearAll, confirmClear, askClear: () => setConfirmClear(true), cancelClear: () => setConfirmClear(false) };
}
