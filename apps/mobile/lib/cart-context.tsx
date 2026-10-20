import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "./language-context";
import type { Store, Translations } from "./types";

const PENDING_COUPON_KEY = "martly_pending_coupon";

export interface CartItem {
  storeProductId: string;
  productId: string;
  productName: string;
  /** The product's name in other languages; absent on carts saved before this was added */
  translations?: Translations | null;
  variantId: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
}

/** The cart's store, kept with its translations so the name follows the app language */
export interface CartStore {
  id: string;
  name: string;
  translations?: Store["translations"];
}

interface CartState {
  store: CartStore | null;
  storeId: string | null;
  /** In the app language */
  storeName: string | null;
  items: CartItem[];
  addItem: (store: CartStore, item: Omit<CartItem, "quantity">) => void;
  /** Adds several lines at once, e.g. a reorder; a cart from another store is replaced */
  addItems: (store: CartStore, lines: CartItem[]) => void;
  removeItem: (storeProductId: string) => void;
  updateQuantity: (storeProductId: string, quantity: number) => void;
  clearCart: () => void;
  /** Undo: puts back lines removed a moment ago at their old positions, unless the cart has moved to another store */
  restoreItems: (store: CartStore, lines: { item: CartItem; index: number }[]) => void;
  totalAmount: number;
  itemCount: number;
  productQuantityMap: Map<string, number>;
  /** A coupon saved from Home, applied when checkout opens; survives app restarts */
  pendingCoupon: string | null;
  setPendingCoupon: (code: string | null) => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { getLocalizedName } = useLanguage();
  const [store, setStore] = useState<CartStore | null>(null);
  const storeId = store?.id ?? null;
  const storeName = store ? getLocalizedName(store) : null;
  const [items, setItems] = useState<CartItem[]>([]);
  const [pendingCoupon, setPendingCouponState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_COUPON_KEY).then((saved) => {
      if (saved) setPendingCouponState((current) => current ?? saved);
    });
  }, []);

  const setPendingCoupon = useCallback((code: string | null) => {
    setPendingCouponState(code);
    if (code) void AsyncStorage.setItem(PENDING_COUPON_KEY, code);
    else void AsyncStorage.removeItem(PENDING_COUPON_KEY);
  }, []);

  const addItem = useCallback(
    (newStore: CartStore, item: Omit<CartItem, "quantity">) => {
      if (storeId && storeId !== newStore.id) {
        // Different store — caller should have confirmed via Alert already
        setItems([{ ...item, quantity: 1 }]);
        setStore(newStore);
        return;
      }

      setStore(newStore);
      setItems((prev) => {
        const existing = prev.find((i) => i.storeProductId === item.storeProductId);
        if (existing) {
          return prev.map((i) =>
            i.storeProductId === item.storeProductId ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
        return [...prev, { ...item, quantity: 1 }];
      });
    },
    [storeId],
  );

  const addItems = useCallback(
    (newStore: CartStore, lines: CartItem[]) => {
      const replace = storeId !== newStore.id;
      setStore(newStore);
      setItems((prev) => {
        const next = replace ? [] : [...prev];
        for (const line of lines) {
          const at = next.findIndex((i) => i.storeProductId === line.storeProductId);
          if (at >= 0) next[at] = { ...next[at], quantity: next[at].quantity + line.quantity };
          else next.push(line);
        }
        return next;
      });
    },
    [storeId],
  );

  const removeItem = useCallback((storeProductId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.storeProductId !== storeProductId);
      if (next.length === 0) {
        setStore(null);
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((storeProductId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => {
        const next = prev.filter((i) => i.storeProductId !== storeProductId);
        if (next.length === 0) {
          setStore(null);
        }
        return next;
      });
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.storeProductId === storeProductId ? { ...i, quantity } : i)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setStore(null);
    setItems([]);
  }, []);

  const restoreItems = useCallback(
    (from: CartStore, lines: { item: CartItem; index: number }[]) => {
      if (storeId && storeId !== from.id) return;
      setStore(from);
      setItems((prev) => {
        const next = [...prev];
        for (const { item, index } of [...lines].sort((a, b) => a.index - b.index)) {
          if (!next.some((i) => i.storeProductId === item.storeProductId)) next.splice(Math.min(index, next.length), 0, item);
        }
        return next;
      });
    },
    [storeId],
  );

  const totalAmount = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const productQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [items]);

  return (
    <CartContext.Provider
      value={{ store, storeId, storeName, items, addItem, addItems, removeItem, updateQuantity, clearCart, restoreItems, totalAmount, itemCount, productQuantityMap, pendingCoupon, setPendingCoupon }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
