import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { api } from "./api";
import type { Store } from "./types";

const SELECTED_STORE_KEY = "martly_selected_store";
const NEARBY_RADIUS_KM = 20;

export type LocationStatus = "pending" | "granted" | "denied";

interface StoreState {
  stores: Store[];
  nearbyStores: Store[];
  selectedStore: Store | null;
  loading: boolean;
  locationStatus: LocationStatus;
  userArea: string | null;
  userLocation: { latitude: number; longitude: number } | null;
  setSelectedStore: (store: Store) => void;
  clearSelectedStore: () => void;
  refreshStores: () => Promise<void>;
  requestLocation: () => Promise<void>;
}

const StoreContext = createContext<StoreState | null>(null);

async function resolveArea(latitude: number, longitude: number): Promise<string | null> {
  const [place] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  if (!place) return null;
  return [place.district ?? place.street, place.city ?? place.subregion].filter(Boolean).join(", ") || null;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("pending");
  const [userArea, setUserArea] = useState<string | null>(null);
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

  const loadNearbyStores = useCallback(async (): Promise<Store[] | null> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocationStatus("denied");
      return null;
    }
    setLocationStatus("granted");
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      resolveArea(latitude, longitude).then(setUserArea);

      const res = await api.get<Store[]>(
        `/api/v1/stores/nearby?lat=${latitude}&lng=${longitude}&radius=${NEARBY_RADIUS_KM}`,
      );
      setNearbyStores(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const setSelectedStore = useCallback((store: Store) => {
    setSelectedStoreState(store);
    SecureStore.setItemAsync(SELECTED_STORE_KEY, store.id).catch(() => {});
  }, []);

  // Load stores, restore persisted selection, then look up stores near the user
  useEffect(() => {
    (async () => {
      const storeList = await fetchStores();
      const savedId = await SecureStore.getItemAsync(SELECTED_STORE_KEY).catch(() => null);
      const saved = savedId ? storeList.find((s) => s.id === savedId) : undefined;
      if (saved) setSelectedStoreState(saved);

      const nearby = await loadNearbyStores();
      // Only decide for the user when there is exactly one store that can deliver to them
      const deliverable = nearby?.filter((s) => s.deliversToYou) ?? [];
      if (!saved && deliverable.length === 1) setSelectedStore(deliverable[0]);

      setLoading(false);
    })();
  }, [fetchStores, loadNearbyStores, setSelectedStore]);

  const clearSelectedStore = useCallback(() => {
    setSelectedStoreState(null);
    SecureStore.deleteItemAsync(SELECTED_STORE_KEY).catch(() => {});
  }, []);

  const refreshStores = useCallback(async () => {
    await Promise.all([fetchStores(), locationStatus === "granted" ? loadNearbyStores() : null]);
  }, [fetchStores, loadNearbyStores, locationStatus]);

  // iOS/Android won't show the permission prompt again once denied — send the user to Settings instead
  const requestLocation = useCallback(async () => {
    const { canAskAgain, status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted" && !canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await loadNearbyStores();
  }, [loadNearbyStores]);

  return (
    <StoreContext.Provider
      value={{
        stores, nearbyStores, selectedStore, loading, locationStatus, userArea, userLocation,
        setSelectedStore, clearSelectedStore, refreshStores, requestLocation,
      }}
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
