import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { useStore } from "./store-context";

interface MembershipContextType {
  isMember: boolean;
  freeDelivery: boolean;
  refresh: () => void;
}

const MembershipContext = createContext<MembershipContextType>({
  isMember: false,
  freeDelivery: false,
  refresh: () => {},
});

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { selectedStore } = useStore();
  const [isMember, setIsMember] = useState(false);
  const [freeDelivery, setFreeDelivery] = useState(false);

  const refresh = useCallback(() => {
    if (!isAuthenticated || !selectedStore) {
      setIsMember(false);
      setFreeDelivery(false);
      return;
    }
    api
      .get<{ isMember: boolean; membership?: { freeDelivery?: boolean } }>(`/api/v1/memberships/status?storeId=${selectedStore.id}`)
      .then((res) => {
        setIsMember(res.data.isMember);
        setFreeDelivery(res.data.isMember && res.data.membership?.freeDelivery === true);
      })
      .catch(() => {
        setIsMember(false);
        setFreeDelivery(false);
      });
  }, [isAuthenticated, selectedStore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MembershipContext.Provider value={{ isMember, freeDelivery, refresh }}>
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  return useContext(MembershipContext);
}

/**
 * Returns the best price for cart: uses memberPrice if user is a member
 * and memberPrice is lower than the effective/discount price.
 */
export function getBestPrice(
  sp: { price: number; pricing?: { discountActive: boolean; effectivePrice: number; memberPrice: number | null } | null },
  isMember: boolean,
): number {
  const effectivePrice = sp.pricing?.discountActive
    ? sp.pricing.effectivePrice
    : Number(sp.price);
  if (isMember && sp.pricing?.memberPrice != null && sp.pricing.memberPrice < effectivePrice) {
    return sp.pricing.memberPrice;
  }
  return effectivePrice;
}
