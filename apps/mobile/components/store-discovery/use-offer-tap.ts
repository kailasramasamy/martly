import { Alert } from "react-native";
import { hasBannerTarget, openBannerTarget } from "../../lib/banner-action";
import { useCart } from "../../lib/cart-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useLanguage } from "../../lib/language-context";
import type { Store } from "../../lib/types";
import type { StoreBanner } from "./StoreDetailPanel";

/**
 * Tapping a store's banner in the store chooser: at the current store it opens like on home;
 * at another store it asks first, since the offer only applies once you shop there.
 * The offer takes the chooser's place, so going back lands on home.
 */
export function useOfferTap(current: Store | null, switchTo: (store: Store) => void) {
  const { itemCount, storeId: cartStoreId } = useCart();
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();

  return (store: Store, banner: StoreBanner) => {
    if (!hasBannerTarget(banner)) return;
    if (store.id === current?.id) {
      openBannerTarget(banner, "replace");
      return;
    }
    const name = getLocalizedName(store);
    const from = current ? t.switchFrom(getLocalizedName(current), name) : t.startShopping(name);
    const cart = itemCount > 0 && cartStoreId !== store.id ? t.cartMoves(itemCount, name) : "";
    Alert.alert(t.seeOfferAt(name), from + cart, [
      { text: t.notNow, style: "cancel" },
      { text: t.switchAndSee, onPress: () => { switchTo(store); openBannerTarget(banner, "replace"); } },
    ]);
  };
}
