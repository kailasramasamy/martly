import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import { Linking } from "react-native";
import { api } from "./api";
import { useAuth } from "./auth-context";
import type { StoreResolution } from "@martly/shared/types";
import type { Store } from "./types";

const SELECTED_STORE_KEY = "martly_selected_store";

export type LocationStatus = "pending" | "granted" | "denied";
type Point = { latitude: number; longitude: number };

interface StoreState {
  stores: Store[];
  nearbyStores: Store[];
  /** Null only while loading, or when no store is live anywhere */
  selectedStore: Store | null;
  /** Known only once the shopper shares a location */
  deliversToYou: boolean | null;
  loading: boolean;
  locationStatus: LocationStatus;
  userArea: string | null;
  userLocation: Point | null;
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

function resolveUrl(point: Point | null, current: string | null) {
  const params = new URLSearchParams();
  if (current) params.set("current", current);
  if (point) {
    params.set("lat", String(point.latitude));
    params.set("lng", String(point.longitude));
  }
  return `/api/v1/stores/resolve?${params}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [nearbyStores, setNearbyStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("pending");
  const [userArea, setUserArea] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  // Only a store the shopper picked is remembered; one picked for them is re-picked as they move
  const chosenId = useRef<string | null>(null);
  const point = useRef<Point | null>(null);

  const fetchStores = useCallback(async () => {
    const res = await api.getList<Store>("/api/v1/stores").catch(() => null);
    if (res) setStores(res.data);
  }, []);

  const locate = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationStatus(status === "granted" ? "granted" : "denied");
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
    if (!loc) return;
    const { latitude, longitude } = loc.coords;
    point.current = { latitude, longitude };
    setUserLocation(point.current);
    resolveArea(latitude, longitude).then(setUserArea);
  }, []);

  // The store to shop at: the chosen one while it is live, else the nearest that delivers, else the town's main store
  const resolve = useCallback(async () => {
    const res = await api.get<StoreResolution<Store>>(resolveUrl(point.current, chosenId.current)).catch(() => null);
    if (!res) return;
    setSelectedStoreState(res.data.store);
    if (point.current) setNearbyStores([res.data.store, ...res.data.alternatives]);
  }, []);

  const setSelectedStore = useCallback((store: Store) => {
    chosenId.current = store.id;
    setSelectedStoreState(store);
    SecureStore.setItemAsync(SELECTED_STORE_KEY, store.id).catch(() => {});
  }, []);

  const { signOuts } = useAuth();
  const signOutsRef = useRef(signOuts);
  signOutsRef.current = signOuts;

  useEffect(() => {
    (async () => {
      const signOutsBefore = signOutsRef.current;
      fetchStores();
      const savedId = await SecureStore.getItemAsync(SELECTED_STORE_KEY).catch(() => null);
      // A sign-out while this was loading (a refused saved session) means the saved store belonged to someone else
      chosenId.current = signOutsRef.current === signOutsBefore ? savedId : null;
      await locate();
      await resolve();
      setLoading(false);
    })();
  }, [fetchStores, locate, resolve]);

  const clearSelectedStore = useCallback(() => {
    chosenId.current = null;
    SecureStore.deleteItemAsync(SELECTED_STORE_KEY).catch(() => {});
    resolve();
  }, [resolve]);

  // Signing out (or a deleted account) hands the phone to the next shopper, who gets a store picked afresh
  useEffect(() => {
    if (signOuts > 0) clearSelectedStore();
  }, [signOuts, clearSelectedStore]);

  const refreshStores = useCallback(async () => {
    await Promise.all([fetchStores(), resolve()]);
  }, [fetchStores, resolve]);

  // iOS/Android won't show the permission prompt again once denied — send the user to Settings instead
  const requestLocation = useCallback(async () => {
    const { canAskAgain, status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted" && !canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await locate();
    await resolve();
  }, [locate, resolve]);

  return (
    <StoreContext.Provider
      value={{
        stores, nearbyStores, selectedStore, loading,
        deliversToYou: userLocation ? nearbyStores.find((s) => s.id === selectedStore?.id)?.deliversToYou ?? false : null, locationStatus, userArea, userLocation,
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
