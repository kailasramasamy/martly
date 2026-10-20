import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { useToast } from "./toast-context";
import { useStore } from "./store-context";
import { strings } from "./i18n";

interface WishlistContextType {
  wishlistedIds: Set<string>;
  toggle: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextType>({
  wishlistedIds: new Set(),
  toggle: async () => {},
  isWishlisted: () => false,
  loading: false,
});

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setWishlistedIds(new Set());
      fetched.current = false;
      return;
    }
    if (fetched.current) return;
    fetched.current = true;

    setLoading(true);
    api.get<any[]>("/api/v1/wishlist")
      .then((res) => {
        const ids = new Set(res.data.map((item: any) => item.productId));
        setWishlistedIds(ids);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const wishlistedRef = useRef(wishlistedIds);
  wishlistedRef.current = wishlistedIds;
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;
  const togglingRef = useRef(new Set<string>());

  const toggle = useCallback(async (productId: string) => {
    if (!authRef.current) {
      toast.show(strings("catalog").wishlistSignIn, "error");
      return;
    }
    // Prevent concurrent toggles for the same product
    if (togglingRef.current.has(productId)) return;
    togglingRef.current.add(productId);

    const wasWishlisted = wishlistedRef.current.has(productId);
    // Optimistic update
    setWishlistedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
    toast.show(strings("catalog")[wasWishlisted ? "wishlistRemoved" : "wishlistAdded"], "success");
    try {
      const res = await api.post<{ wishlisted: boolean }>("/api/v1/wishlist/toggle", { productId, storeId });
      // Reconcile with server response (silent — no toast)
      setWishlistedIds((prev) => {
        const next = new Set(prev);
        if (res.data.wishlisted) next.add(productId);
        else next.delete(productId);
        return next;
      });
    } catch (err) {
      // Revert on failure
      setWishlistedIds((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      const msg = err instanceof Error ? err.message : String(err);
      toast.show(msg, "error");
    } finally {
      togglingRef.current.delete(productId);
    }
  }, [toast, storeId]);

  const isWishlisted = useCallback((productId: string) => wishlistedRef.current.has(productId), []);

  return (
    <WishlistContext.Provider value={{ wishlistedIds, toggle, isWishlisted, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
