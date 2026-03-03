import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { api } from "./api";

interface BasketModeState {
  isBasketMode: boolean;
  storeId: string | null;
  itemCount: number;
  basketQuantities: Map<string, number>;
  enterBasketMode: (storeId: string) => void;
  exitBasketMode: () => void;
  addBasketItem: (storeProductId: string) => void;
  updateBasketQuantity: (storeProductId: string, newQty: number) => void;
}

const EMPTY_MAP = new Map<string, number>();

const BasketModeContext = createContext<BasketModeState>({
  isBasketMode: false,
  storeId: null,
  itemCount: 0,
  basketQuantities: EMPTY_MAP,
  enterBasketMode: () => {},
  exitBasketMode: () => {},
  addBasketItem: () => {},
  updateBasketQuantity: () => {},
});

export function BasketModeProvider({ children }: { children: ReactNode }) {
  const [isBasketMode, setIsBasketMode] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [basketQuantities, setBasketQuantities] = useState<Map<string, number>>(EMPTY_MAP);
  const qtyRef = useRef(new Map<string, number>());

  const itemCount = basketQuantities.size;

  const enterBasketMode = useCallback((sid: string) => {
    setIsBasketMode(true);
    setStoreId(sid);
    qtyRef.current = new Map();
    setBasketQuantities(new Map());
  }, []);

  const exitBasketMode = useCallback(() => {
    setIsBasketMode(false);
    setStoreId(null);
    qtyRef.current = new Map();
    setBasketQuantities(new Map());
  }, []);

  const addBasketItem = useCallback((spId: string) => {
    const prev = qtyRef.current.get(spId) ?? 0;
    const newQty = prev + 1;
    qtyRef.current.set(spId, newQty);
    setBasketQuantities(new Map(qtyRef.current));

    api
      .post("/api/v1/subscriptions/basket/items", {
        storeProductId: spId,
        quantity: newQty,
      })
      .catch(() => {
        // Revert on failure
        const reverted = (qtyRef.current.get(spId) ?? 1) - 1;
        if (reverted <= 0) qtyRef.current.delete(spId);
        else qtyRef.current.set(spId, reverted);
        setBasketQuantities(new Map(qtyRef.current));
      });
  }, []);

  const updateBasketQuantity = useCallback((spId: string, newQty: number) => {
    const prevQty = qtyRef.current.get(spId) ?? 0;

    if (newQty <= 0) {
      qtyRef.current.delete(spId);
      setBasketQuantities(new Map(qtyRef.current));
      api.delete(`/api/v1/subscriptions/basket/items/${spId}`).catch(() => {
        qtyRef.current.set(spId, prevQty);
        setBasketQuantities(new Map(qtyRef.current));
      });
    } else {
      qtyRef.current.set(spId, newQty);
      setBasketQuantities(new Map(qtyRef.current));
      api
        .patch(`/api/v1/subscriptions/basket/items/${spId}`, { quantity: newQty })
        .catch(() => {
          if (prevQty <= 0) qtyRef.current.delete(spId);
          else qtyRef.current.set(spId, prevQty);
          setBasketQuantities(new Map(qtyRef.current));
        });
    }
  }, []);

  return (
    <BasketModeContext.Provider
      value={{
        isBasketMode,
        storeId,
        itemCount,
        basketQuantities,
        enterBasketMode,
        exitBasketMode,
        addBasketItem,
        updateBasketQuantity,
      }}
    >
      {children}
    </BasketModeContext.Provider>
  );
}

export function useBasketMode() {
  return useContext(BasketModeContext);
}
