import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lineTotal, type MultiBuyOffer } from "@martly/shared/offers";
import { useLanguage } from "./language-context";
import { getBestPrice } from "./membership-context";
import type { Store, StoreProduct, Translations } from "./types";
import type { SectionSource } from "./home-events";

const PENDING_COUPON_KEY = "martly_pending_coupon";
/** The cart (its store and lines), so it survives an app restart or the OS killing the app */
const CART_KEY = "martly_cart";

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
  /** Buy X get Y on the line; absent on carts saved before offers, until the cart review brings it */
  offer?: MultiBuyOffer | null;
  /** The Home section it was first added from, credited on the order */
  source?: SectionSource;
}

/** The store's current terms for a line: the price it charges and any buy X get Y running */
export interface LineTerms {
  price: number;
  offer: MultiBuyOffer | null;
}

/** A cart line for a store listing, at the shopper's best price and with its offer */
export function toCartItem(sp: StoreProduct, quantity: number, isMember: boolean): CartItem {
  return {
    storeProductId: sp.id,
    productId: sp.product.id,
    productName: sp.product.name,
    translations: sp.product.translations,
    variantId: sp.variant.id,
    variantName: sp.variant.name,
    price: getBestPrice(sp, isMember),
    imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl ?? null,
    offer: sp.pricing?.offer ?? null,
    quantity,
  };
}

/** The cart's store, kept with its translations so the name follows the app language */
export interface CartStore {
  id: string;
  name: string;
  translations?: Store["translations"];
}

export interface CartState {
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
  /** Swaps a line for another size in the same place, e.g. a bigger pack that saves */
  replaceItem: (storeProductId: string, line: CartItem) => void;
  /** Sets lines to the store's current price and offer (keyed by storeProductId) */
  repriceItems: (terms: Map<string, LineTerms>) => void;
  clearCart: () => void;
  /** Puts these lines in place of the whole cart, e.g. the cart moved to another store */
  replaceCart: (store: CartStore, lines: CartItem[]) => void;
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

/** What a basket of lines comes to: the amount, the packs, and the packs of each product */
export function cartTotals(items: CartItem[]) {
  const productQuantityMap = new Map<string, number>();
  for (const item of items) productQuantityMap.set(item.productId, (productQuantityMap.get(item.productId) ?? 0) + item.quantity);
  return {
    totalAmount: items.reduce((sum, i) => sum + lineTotal(i.price, i.quantity, i.offer), 0),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    productQuantityMap,
  };
}

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function isCartLine(line: unknown): line is CartItem {
  if (!line || typeof line !== "object") return false;
  const l = line as Record<string, unknown>;
  return isText(l.storeProductId) && isText(l.productId) && isText(l.variantId) && typeof l.productName === "string"
    && typeof l.variantName === "string" && typeof l.price === "number" && Number.isFinite(l.price)
    && Number.isInteger(l.quantity) && (l.quantity as number) > 0;
}

/** A saved cart, or null when there is none or it isn't one this app wrote; malformed lines are dropped */
function parseSavedCart(raw: string | null): { store: CartStore; items: CartItem[] } | null {
  if (!raw) return null;
  let saved: { store?: Partial<CartStore>; items?: unknown };
  try {
    saved = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
  if (!saved?.store || !isText(saved.store.id) || typeof saved.store.name !== "string" || !Array.isArray(saved.items)) return null;
  const items = saved.items.filter(isCartLine);
  return items.length ? { store: saved.store as CartStore, items } : null;
}

/** Puts another basket in the cart's place for the screens inside, e.g. a walk that fills the monthly list */
export function CartScope({ value, children }: { value: CartState; children: ReactNode }) {
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { getLocalizedName } = useLanguage();
  const [store, setStore] = useState<CartStore | null>(null);
  const storeId = store?.id ?? null;
  const storeName = store ? getLocalizedName(store) : null;
  const [items, setItems] = useState<CartItem[]>([]);
  const [pendingCoupon, setPendingCouponState] = useState<string | null>(null);
  // Nothing is saved until the saved cart is read back, so the empty cart at launch can't overwrite it
  const [hydrated, setHydrated] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .catch(() => null)
      .then((raw) => {
        const saved = parseSavedCart(raw);
        // A line added while it was reading wins over the saved cart
        if (saved && itemsRef.current.length === 0) {
          setStore(saved.store);
          setItems(saved.items);
        }
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (store && items.length) void AsyncStorage.setItem(CART_KEY, JSON.stringify({ store, items })).catch(() => undefined);
    else void AsyncStorage.removeItem(CART_KEY).catch(() => undefined);
  }, [hydrated, store, items]);

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

  const replaceItem = useCallback((storeProductId: string, line: CartItem) => {
    setItems((prev) => prev.map((i) => (i.storeProductId === storeProductId ? line : i)));
  }, []);

  const repriceItems = useCallback((terms: Map<string, LineTerms>) => {
    setItems((prev) => prev.map((i) => (terms.has(i.storeProductId) ? { ...i, ...terms.get(i.storeProductId)! } : i)));
  }, []);

  const clearCart = useCallback(() => {
    setStore(null);
    setItems([]);
  }, []);

  const replaceCart = useCallback((to: CartStore, lines: CartItem[]) => {
    setStore(lines.length ? to : null);
    setItems(lines);
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

  const { totalAmount, itemCount, productQuantityMap } = useMemo(() => cartTotals(items), [items]);

  return (
    <CartContext.Provider
      value={{ store, storeId, storeName, items, addItem, addItems, removeItem, updateQuantity, replaceItem, repriceItems, clearCart, replaceCart, restoreItems, totalAmount, itemCount, productQuantityMap, pendingCoupon, setPendingCoupon }}
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
