import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { toCartItem, useCart, type CartStore } from "./cart-context";
import { useBasketMode } from "./basket-mode-context";
import { useMembership } from "./membership-context";
import { useWishlist } from "./wishlist-context";
import { useRequireSignIn } from "./sign-in-context";
import { useToast } from "./toast-context";
import { useStrings } from "./i18n/use-strings";
import { VariantBottomSheet } from "../components/VariantBottomSheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { SearchEventType } from "@martly/shared/constants";
import type { StoreProduct } from "./types";

export interface ProductActions {
  storeId: string | undefined;
  cartQuantityMap: Map<string, number>;
  /** Adds one, or `quantity` (e.g. the packs a spoken list asked for) */
  addToCart: (sp: StoreProduct, quantity?: number) => void;
  updateQuantity: (storeProductId: string, quantity: number) => void;
  showVariants: (variants: StoreProduct[]) => void;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  isMember: boolean;
  // Set when the screen tracks what shoppers do with its products (search results)
  trackOpen?: (productId: string) => void;
}

const ProductActionsContext = createContext<ProductActions | null>(null);

// Cart / tomorrow's-basket logic shared by every screen that lists products
function useCartActions(store: CartStore | null) {
  const { storeId: cartStoreId, items, addItem, addItems, updateQuantity: updateCartQty } = useCart();
  const { isBasketMode, addBasketItem, updateBasketQuantity, basketQuantities } = useBasketMode();
  const { isMember } = useMembership();
  const toast = useToast();
  const t = useStrings("catalog");
  const [pendingReplace, setPendingReplace] = useState<(() => void) | null>(null);

  const cartQtyMap = useMemo(() => new Map(items.map((i) => [i.storeProductId, i.quantity])), [items]);

  const addToCart = useCallback((sp: StoreProduct, quantity = 1) => {
    if (!store) return;
    if (isBasketMode) {
      addBasketItem(sp.id);
      toast.show(t.addedToBasket, "success");
      return;
    }
    const item = toCartItem(sp, quantity, isMember);
    const add = () => (quantity > 1 ? addItems(store, [item]) : addItem(store, item));
    // The cart holds one store at a time: confirm before discarding another store's cart
    if (cartStoreId && cartStoreId !== store.id) setPendingReplace(() => add);
    else add();
  }, [store, cartStoreId, addItem, addItems, isMember, isBasketMode, addBasketItem, toast, t]);

  const updateQuantity = useCallback((spId: string, qty: number) => {
    if (isBasketMode) updateBasketQuantity(spId, qty);
    else updateCartQty(spId, qty);
  }, [isBasketMode, updateBasketQuantity, updateCartQty]);

  return {
    cartQuantityMap: isBasketMode ? basketQuantities : cartQtyMap,
    addToCart, updateQuantity, isMember, pendingReplace, setPendingReplace,
  };
}

/**
 * Wrap a screen that lists products. Provides cart/wishlist actions to every <ProductList> inside it,
 * and renders the size picker and "Replace cart?" prompt once, full-screen.
 */
export function ProductActionsProvider({ store, onTrack, children }: {
  store: CartStore | null;
  onTrack?: (productId: string, type: SearchEventType) => void;
  children: ReactNode;
}) {
  const { pendingReplace, setPendingReplace, ...cart } = useCartActions(store);
  const t = useStrings("catalog");
  const { isWishlisted, toggle } = useWishlist();
  const requireSignIn = useRequireSignIn();
  const toggleWishlist = useCallback(
    (productId: string) => requireSignIn(() => toggle(productId), { title: t.signInWishlist }),
    [requireSignIn, toggle, t],
  );
  const [sheetVariants, setSheetVariants] = useState<StoreProduct[]>([]);

  const addToCart = useCallback((sp: StoreProduct, quantity?: number) => {
    cart.addToCart(sp, quantity);
    onTrack?.(sp.product.id, SearchEventType.ADD_TO_CART);
  }, [cart.addToCart, onTrack]);
  const trackOpen = useMemo(() => onTrack && ((productId: string) => onTrack(productId, SearchEventType.CLICK)), [onTrack]);

  const value = useMemo<ProductActions>(() => ({
    ...cart, addToCart, trackOpen, storeId: store?.id, showVariants: setSheetVariants, isWishlisted, toggleWishlist,
  }), [cart.cartQuantityMap, addToCart, trackOpen, cart.updateQuantity, cart.isMember, store?.id, isWishlisted, toggleWishlist]);

  // The sheet is a modal, so a replace-cart prompt raised from it has to show inside it
  const sheetOpen = sheetVariants.length > 0;
  const replacePrompt = (
    <ConfirmSheet
      visible={pendingReplace !== null}
      title={t.replaceCartTitle}
      message={t.replaceCartMessage}
      icon="cart-outline"
      iconColor="#f59e0b"
      confirmLabel={t.replaceCartConfirm}
      onConfirm={() => { pendingReplace?.(); setPendingReplace(null); }}
      onCancel={() => setPendingReplace(null)}
    />
  );

  return (
    <ProductActionsContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        <VariantBottomSheet
          visible={sheetOpen}
          onClose={() => setSheetVariants([])}
          variants={sheetVariants}
          onAddToCart={addToCart}
          onUpdateQuantity={cart.updateQuantity}
          cartQuantityMap={cart.cartQuantityMap}
          isMember={cart.isMember}
        >
          {sheetOpen && replacePrompt}
        </VariantBottomSheet>
        {!sheetOpen && replacePrompt}
      </View>
    </ProductActionsContext.Provider>
  );
}

export function useProductActions(): ProductActions {
  const ctx = useContext(ProductActionsContext);
  if (!ctx) throw new Error("useProductActions must be used within a ProductActionsProvider");
  return ctx;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
