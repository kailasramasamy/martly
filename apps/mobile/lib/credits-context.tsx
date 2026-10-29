import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { CreditGrantView, CreditOffer, CustomerCredits } from "@martly/shared/types";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { useStore } from "./store-context";

type Point = { latitude: number; longitude: number };

interface CreditsState extends CustomerCredits {
  /** Grants spendable at the selected store: Martly's, and this store's own */
  storeGrants: CreditGrantView[];
  /** What signing up would give a guest */
  offers: CreditOffer[];
  /** Offers, grants and claims are read for shoppers only; staff accounts see none */
  isCustomer: boolean;
  /** The shopper's location is known and no store is near enough to deliver or pick up from */
  outOfArea: boolean;
  refresh: () => Promise<void>;
  markSeen: (grantId: string) => void;
}

const EMPTY: CustomerCredits = { grants: [], pending: [] };

const CreditsContext = createContext<CreditsState>({
  ...EMPTY, storeGrants: [], offers: [], isCustomer: false, outOfArea: false, refresh: async () => undefined, markSeen: () => undefined,
});

/** The customer's credit at a store: claims it once the store delivers to them, otherwise reads what they hold */
async function loadCustomer(storeId: string, claimAt: Point | null, claimed: Set<string>, claimKey: string) {
  if (claimAt && !claimed.has(claimKey)) {
    claimed.add(claimKey);
    const res = await api.post<CustomerCredits>("/api/v1/credits/claim", { storeId, lat: claimAt.latitude, lng: claimAt.longitude }).catch(() => null);
    if (res) return res.data;
    claimed.delete(claimKey);
  }
  const res = await api.get<CustomerCredits>(`/api/v1/credits/me?storeId=${storeId}`).catch(() => null);
  return res?.data ?? null;
}

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { selectedStore, nearbyStores, userLocation } = useStore();
  const [credits, setCredits] = useState<CustomerCredits>(EMPTY);
  const [offers, setOffers] = useState<CreditOffer[]>([]);
  // Store claims already made in this session, per signed-in customer
  const claimed = useRef(new Set<string>());
  const storeId = selectedStore?.id;
  const userId = user?.id;
  const isCustomer = isAuthenticated && user?.role === "CUSTOMER";
  const isGuest = !isAuthenticated && !isLoading;
  // A store within the nearby radius carries its distance and can be ordered from, delivered or picked up; a remembered
  // store far away is listed without one
  const nearby = !!userLocation && nearbyStores.some((s) => s.id === storeId && s.distance !== undefined);
  const claimAt = nearby ? userLocation : null;
  const outOfArea = !!userLocation && !nearby;

  const load = useCallback(async (claim: boolean) => {
    if (!storeId) return;
    if (isCustomer) {
      const next = await loadCustomer(storeId, claim ? claimAt : null, claimed.current, `${userId}:${storeId}`);
      if (next) setCredits(next);
    } else if (isGuest) {
      const res = await api.get<CreditOffer[]>(`/api/v1/credits/offers?storeId=${storeId}`).catch(() => null);
      if (res) setOffers(res.data);
    }
  }, [storeId, isCustomer, isGuest, userId, claimAt]);

  useEffect(() => {
    if (!isCustomer) setCredits(EMPTY);
    if (!isGuest) setOffers([]);
  }, [isCustomer, isGuest, userId]);

  useEffect(() => {
    load(true);
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  const markSeen = useCallback((grantId: string) => {
    setCredits((prev) => ({ ...prev, grants: prev.grants.map((g) => (g.id === grantId ? { ...g, announced: true } : g)) }));
    api.post(`/api/v1/credits/grants/${grantId}/seen`, {}).catch(() => undefined);
  }, []);

  const value = useMemo(() => {
    const storeGrants = credits.grants.filter((g) => g.storeId === null || g.storeId === storeId);
    return { ...credits, storeGrants, offers, isCustomer, outOfArea, refresh, markSeen };
  }, [credits, storeId, offers, isCustomer, outOfArea, refresh, markSeen]);
  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export const useCredits = () => useContext(CreditsContext);
