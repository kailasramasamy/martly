import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "./api";

/** Wallet balance and loyalty points for the home chip; refreshed each time the screen regains focus */
export function useRewardsSummary(isAuthenticated: boolean, storeId: string | undefined) {
  const [wallet, setWallet] = useState(0);
  const [points, setPoints] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        setWallet(0);
        setPoints(0);
        return;
      }
      // A missed refresh just leaves the last known figures; the chip is a hint, not a ledger
      api.get<{ balance: number }>("/api/v1/wallet").then((res) => setWallet(Number(res.data.balance)), () => undefined);
      if (storeId) {
        api.get<{ balance: { points: number } }>(`/api/v1/loyalty?storeId=${storeId}`)
          .then((res) => setPoints(res.data.balance.points), () => undefined);
      }
    }, [isAuthenticated, storeId]),
  );

  return { wallet, points };
}
