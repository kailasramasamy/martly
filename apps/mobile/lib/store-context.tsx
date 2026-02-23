import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import type { Store } from "./types";

const SELECTED_STORE_KEY = "martly_selected_store";

interface StoreState {
  stores: Store[];
  selectedStore: Store | null;
  loading: boolean;
  setSelectedStore: (store: Store) => void;
  clearSelectedStore: () => void;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    try {
      const res = await api.getList<Store>("/api/v1/stores");
      setStores(res.data);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  // Load stores and restore persisted selection
  useEffect(() => {
    (async () => {
      const storeList = await fetchStores();
      try {
        const savedId = await SecureStore.getItemAsync(SELECTED_STORE_KEY);
        if (savedId && storeList.length > 0) {
          const found = storeList.find((s) => s.id === savedId);
          if (found) setSelectedStoreState(found);
        }
      } catch {
        // ignore restore errors
      }
      setLoading(false);
    })();
  }, [fetchStores]);

  const setSelectedStore = useCallback((store: Store) => {
    setSelectedStoreState(store);
    SecureStore.setItemAsync(SELECTED_STORE_KEY, store.id).catch(() => {});
  }, []);

  const clearSelectedStore = useCallback(() => {
    setSelectedStoreState(null);
    SecureStore.deleteItemAsync(SELECTED_STORE_KEY).catch(() => {});
  }, []);

  const refreshStores = useCallback(async () => {
    await fetchStores();
  }, [fetchStores]);

  return (
    <StoreContext.Provider
      value={{ stores, selectedStore, loading, setSelectedStore, clearSelectedStore, refreshStores }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
}
