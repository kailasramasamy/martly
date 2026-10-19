import { useEffect, useRef } from "react";
import { addSocketListener } from "./sharedSocket";

interface UseOrderWebSocketOptions {
  /** Subscribe to a specific order's full updates (show page) */
  orderId?: string;
  /** Called when a subscribed order receives full data update */
  onOrderUpdated?: (orderId: string, data: unknown) => void;
  /** Called when any order changes (lightweight hint for list pages) */
  onOrdersChanged?: (orderId: string, status: string) => void;
  /** Whether the hook should be active */
  enabled?: boolean;
}

export function useOrderWebSocket({
  orderId,
  onOrderUpdated,
  onOrdersChanged,
  enabled = true,
}: UseOrderWebSocketOptions) {
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  const onOrdersChangedRef = useRef(onOrdersChanged);
  onOrderUpdatedRef.current = onOrderUpdated;
  onOrdersChangedRef.current = onOrdersChanged;

  useEffect(() => {
    if (!enabled) return;
    return addSocketListener((msg) => {
      if (msg.type === "order:updated") {
        onOrderUpdatedRef.current?.(msg.orderId as string, msg.data);
      } else if (msg.type === "orders:changed") {
        onOrdersChangedRef.current?.(msg.orderId as string, msg.status as string);
      }
    }, orderId);
  }, [orderId, enabled]);
}
