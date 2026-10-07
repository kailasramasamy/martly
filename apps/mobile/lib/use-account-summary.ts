import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";
import type { UserAddress } from "./types";

// Wallet, loyalty, Mart Plus status and saved addresses for the Account tab; refreshed whenever it gains focus
export function useAccountSummary(isAuthenticated: boolean, storeId: string | undefined) {
  const [walletBalance, setWalletBalance] = useState(0);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const res = await api.get<UserAddress[]>("/api/v1/addresses");
      setAddresses(res.data);
    } catch {
      // keep the previously loaded list
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      fetchAddresses();
      api.get<{ balance: number }>("/api/v1/wallet").then((res) => setWalletBalance(res.data.balance)).catch(() => {});
      if (!storeId) return;
      api.get<{ balance: { points: number } }>(`/api/v1/loyalty?storeId=${storeId}`)
        .then((res) => setLoyaltyPoints(res.data.balance.points)).catch(() => {});
      api.get<{ isMember: boolean }>(`/api/v1/memberships/status?storeId=${storeId}`)
        .then((res) => setIsMember(res.data.isMember)).catch(() => {});
    }, [isAuthenticated, fetchAddresses, storeId]),
  );

  return { walletBalance, loyaltyPoints, isMember, addresses, loadingAddresses, fetchAddresses };
}
