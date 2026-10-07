import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useCart } from "./cart-context";
import { useBasketMode } from "./basket-mode-context";
import { useMembership, getBestPrice } from "./membership-context";
import { useWishlist } from "./wishlist-context";
import { useToast } from "./toast-context";
import { VariantBottomSheet } from "../components/VariantBottomSheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import type { StoreProduct } from "./types";

export interface ProductActions {
  storeId: string | undefined;
  cartQuantityMap: Map<string, number>;
  addToCart: (sp: StoreProduct) => void;
  updateQuantity: (storeProductId: string, quantity: number) => void;
  showVariants: (variants: StoreProduct[]) => void;
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  isMember: boolean;
}

const ProductActionsContext = createContext<ProductActions | null>(null);

// Cart / tomorrow's-basket logic shared by every screen that lists products
function useCartActions(store: { id: string; name: string } | null) {
  const { storeId: cartStoreId, items, addItem, updateQuantity: updateCartQty } = useCart();
  const { isBasketMode, addBasketItem, updateBasketQuantity, basketQuantities } = useBasketMode();
  const { isMember } = useMembership();
  const toast = useToast();
  const [pendingReplace, setPendingReplace] = useState<(() => void) | null>(null);

  const cartQtyMap = useMemo(() => new Map(items.map((i) => [i.storeProductId, i.quantity])), [items]);

  const addToCart = useCallback((sp: StoreProduct) => {
    if (!store) return;
    if (isBasketMode) {
      addBasketItem(sp.id);
      toast.show("Added to tomorrow's basket", "success");
      return;
    }
    const item = {
      storeProductId: sp.id, productId: sp.product.id, productName: sp.product.name,
      variantId: sp.variant.id, variantName: sp.variant.name,
      price: getBestPrice(sp, isMember), imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
    };
    const add = () => addItem(store.id, store.name, item);
    // The cart holds one store at a time: confirm before discarding another store's cart
    if (cartStoreId && cartStoreId !== store.id) setPendingReplace(() => add);
    else add();
  }, [store, cartStoreId, addItem, isMember, isBasketMode, addBasketItem, toast]);

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
export function ProductActionsProvider({ store, children }: { store: { id: string; name: string } | null; children: ReactNode }) {
  const { pendingReplace, setPendingReplace, ...cart } = useCartActions(store);
  const { isWishlisted, toggle } = useWishlist();
  const [sheetVariants, setSheetVariants] = useState<StoreProduct[]>([]);

  const value = useMemo<ProductActions>(() => ({
    ...cart, storeId: store?.id, showVariants: setSheetVariants, isWishlisted, toggleWishlist: toggle,
  }), [cart.cartQuantityMap, cart.addToCart, cart.updateQuantity, cart.isMember, store?.id, isWishlisted, toggle]);

  return (
    <ProductActionsContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        <VariantBottomSheet
          visible={sheetVariants.length > 0}
          onClose={() => setSheetVariants([])}
          variants={sheetVariants}
          onAddToCart={cart.addToCart}
          onUpdateQuantity={cart.updateQuantity}
          cartQuantityMap={cart.cartQuantityMap}
          isMember={cart.isMember}
        />
        <ConfirmSheet
          visible={pendingReplace !== null}
          title="Replace Cart?"
          message="Your cart has items from another store. Adding this item will replace your current cart."
          icon="cart-outline"
          iconColor="#f59e0b"
          confirmLabel="Replace"
          onConfirm={() => { pendingReplace?.(); setPendingReplace(null); }}
          onCancel={() => setPendingReplace(null)}
        />
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
