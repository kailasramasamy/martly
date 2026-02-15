import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

interface CartItem {
  storeProductId: string;
  productName: string;
  variantId: string;
  variantName: string;
  price: number;
  quantity: number;
}

interface CartState {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
  addItem: (storeId: string, storeName: string, item: Omit<CartItem, "quantity">) => void;
  removeItem: (storeProductId: string) => void;
  updateQuantity: (storeProductId: string, quantity: number) => void;
  clearCart: () => void;
  totalAmount: number;
  itemCount: number;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (newStoreId: string, newStoreName: string, item: Omit<CartItem, "quantity">) => {
      if (storeId && storeId !== newStoreId) {
        // Different store — caller should have confirmed via Alert already
        setItems([{ ...item, quantity: 1 }]);
        setStoreId(newStoreId);
        setStoreName(newStoreName);
        return;
      }

      setStoreId(newStoreId);
      setStoreName(newStoreName);
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

  const removeItem = useCallback((storeProductId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.storeProductId !== storeProductId);
      if (next.length === 0) {
        setStoreId(null);
        setStoreName(null);
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((storeProductId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => {
        const next = prev.filter((i) => i.storeProductId !== storeProductId);
        if (next.length === 0) {
          setStoreId(null);
          setStoreName(null);
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
    setStoreId(null);
    setStoreName(null);
    setItems([]);
  }, []);

  const totalAmount = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{ storeId, storeName, items, addItem, removeItem, updateQuantity, clearCart, totalAmount, itemCount }}
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
