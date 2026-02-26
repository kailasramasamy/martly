import { useEffect, useRef, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const WS_URL = API_URL.replace(/^http/, "ws");
const MAX_BACKOFF = 30000;

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
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  const onOrdersChangedRef = useRef(onOrdersChanged);
  onOrderUpdatedRef.current = onOrderUpdated;
  onOrdersChangedRef.current = onOrdersChanged;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const token = localStorage.getItem("martly_admin_token");
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      if (orderId) {
        ws.send(JSON.stringify({ type: "subscribe", orderId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "order:updated" && onOrderUpdatedRef.current) {
          onOrderUpdatedRef.current(msg.orderId, msg.data);
        } else if (msg.type === "orders:changed" && onOrdersChangedRef.current) {
          onOrdersChangedRef.current(msg.orderId, msg.status);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose fires after onerror, triggering reconnect
    };
  }, [orderId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    connect();

    // Reconnect on browser tab visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        clearTimeout(reconnectTimerRef.current);
        backoffRef.current = 1000;
        connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);
}
