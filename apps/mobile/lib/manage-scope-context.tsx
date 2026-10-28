import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { usePersona } from "./persona-context";

export interface ManagedStore {
  id: string;
  name: string;
  address: string;
  status: string;
  organizationId: string;
  organizationName: string;
}

interface ManageScopeState {
  stores: ManagedStore[];
  /** null = all stores the user can access */
  storeId: string | null;
  store: ManagedStore | null;
  /** Org of the selected store, else the user's org (undefined for SUPER_ADMIN viewing everything) */
  organizationId: string | undefined;
  allowAllStores: boolean;
  loading: boolean;
  error: string | null;
  setStoreId: (id: string | null) => void;
  refreshStores: () => Promise<void>;
}

const ManageScopeContext = createContext<ManageScopeState | null>(null);

const STORE_KEY = "martly_manage_store";
const ALL_STORES = "all";

export function ManageScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { canManage } = usePersona();
  const [stores, setStores] = useState<ManagedStore[]>([]);
  const [storeId, setStoreIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const allowAllStores = user?.role === "SUPER_ADMIN" || user?.role === "ORG_ADMIN";

  const refreshStores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, saved] = await Promise.all([
        api.getList<ManagedStore>("/api/v1/stores?pageSize=100"),
        AsyncStorage.getItem(STORE_KEY),
      ]);
      setStores(res.data);
      const savedValid = saved && res.data.some((s) => s.id === saved);
      if (savedValid) setStoreIdState(saved);
      // "All stores" means nothing with only one store, so a lone store is always the scope
      else if (saved === ALL_STORES && allowAllStores && res.data.length > 1) setStoreIdState(null);
      else setStoreIdState(allowAllStores && res.data.length > 1 ? null : res.data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your stores");
    } finally {
      setLoading(false);
    }
  }, [allowAllStores]);

  useEffect(() => {
    if (canManage) {
      refreshStores();
      return;
    }
    setStores([]);
    setStoreIdState(null);
  }, [canManage, user?.id, refreshStores]);

  const setStoreId = useCallback((id: string | null) => {
    setStoreIdState(id);
    AsyncStorage.setItem(STORE_KEY, id ?? ALL_STORES);
  }, []);

  const store = stores.find((s) => s.id === storeId) ?? null;
  const organizationId = store?.organizationId ?? user?.organizationId;

  return (
    <ManageScopeContext.Provider
      value={{ stores, storeId, store, organizationId, allowAllStores, loading, error, setStoreId, refreshStores }}
    >
      {children}
    </ManageScopeContext.Provider>
  );
}

export function useManageScope() {
  const context = useContext(ManageScopeContext);
  if (!context) throw new Error("useManageScope must be used within a ManageScopeProvider");
  return context;
}
