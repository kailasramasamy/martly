import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

/** The customer's latest delivered order, for "Last order" shortcuts; null for guests and first-time shoppers */
export function useLastOrderId() {
  const { isAuthenticated } = useAuth();
  const [id, setId] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    if (!isAuthenticated) return setId(null);
    api.getList<{ id: string }>("/api/v1/orders?pageSize=1&status=DELIVERED")
      .then((res) => setId(res.data[0]?.id ?? null))
      .catch((err) => {
        // Only hides the shortcut; the screen itself must not fail over it
        if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      });
  }, [isAuthenticated]));
  return id;
}
