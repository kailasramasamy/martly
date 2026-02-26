import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { api } from "./api";
import type { Store } from "./types";

const SELECTED_STORE_KEY = "martly_selected_store";

interface StoreState {
  stores: Store[];
  selectedStore: Store | null;
  loading: boolean;
  userLocation: { latitude: number; longitude: number } | null;
  setSelectedStore: (store: Store) => void;
  clearSelectedStore: () => void;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const fetchStores = useCallback(async () => {
    try {
      const res = await api.getList<Store>("/api/v1/stores");
      setStores(res.data);
      return res.data;
    } catch {
      return [];
    }
  }, []);

  // Try to get user location and fetch nearby stores
  const tryGetLocationAndNearbyStores = useCallback(async (): Promise<Store[] | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return null;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });

      const res = await api.get<Store[]>(
        `/api/v1/stores/nearby?lat=${latitude}&lng=${longitude}&radius=15`,
      );
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // Load stores and restore persisted selection
  useEffect(() => {
    (async () => {
      const storeList = await fetchStores();
      let restored = false;

      // Try restoring saved selection
      try {
        const savedId = await SecureStore.getItemAsync(SELECTED_STORE_KEY);
        if (savedId && storeList.length > 0) {
          const found = storeList.find((s) => s.id === savedId);
          if (found) {
            setSelectedStoreState(found);
            restored = true;
          }
        }
      } catch {
        // ignore restore errors
      }

      // If no store selected, try auto-selecting nearest
      if (!restored) {
        const nearbyStores = await tryGetLocationAndNearbyStores();
        if (nearbyStores && nearbyStores.length > 0) {
          const nearest = nearbyStores[0];
          setSelectedStoreState(nearest);
          SecureStore.setItemAsync(SELECTED_STORE_KEY, nearest.id).catch(() => {});
        }
      }

      setLoading(false);
    })();
  }, [fetchStores, tryGetLocationAndNearbyStores]);

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
      value={{ stores, selectedStore, loading, userLocation, setSelectedStore, clearSelectedStore, refreshStores }}
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
