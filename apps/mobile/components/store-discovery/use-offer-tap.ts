import { Alert } from "react-native";
import { hasBannerTarget, openBannerTarget } from "../../lib/banner-action";
import { useCart } from "../../lib/cart-context";
import type { Store } from "../../lib/types";
import type { StoreBanner } from "./StoreDetailPanel";

/**
 * Tapping a store's banner in the store chooser: at the current store it opens like on home;
 * at another store it asks first, since the offer only applies once you shop there.
 * The offer takes the chooser's place, so going back lands on home.
 */
export function useOfferTap(current: Store | null, switchTo: (store: Store) => void) {
  const { itemCount, storeName: cartStore } = useCart();

  return (store: Store, banner: StoreBanner) => {
    if (!hasBannerTarget(banner)) return;
    if (store.id === current?.id) {
      openBannerTarget(banner, "replace");
      return;
    }
    const from = current ? `You'll switch from ${current.name} to ${store.name}.` : `You'll start shopping at ${store.name}.`;
    const cart = itemCount > 0 && cartStore
      ? `\n\nYour cart from ${cartStore} (${itemCount} item${itemCount === 1 ? "" : "s"}) is kept until you add something from ${store.name}.`
      : "";
    Alert.alert(`See this offer at ${store.name}?`, from + cart, [
      { text: "Not now", style: "cancel" },
      { text: "Switch & see offer", onPress: () => { switchTo(store); openBannerTarget(banner, "replace"); } },
    ]);
  };
}
