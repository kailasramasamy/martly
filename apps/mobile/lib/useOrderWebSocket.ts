import { useEffect, useRef, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:7001";
const WS_URL = API_URL.replace(/^http/, "ws");
const MAX_BACKOFF = 30000;

interface UseOrderWebSocketOptions {
  /** Subscribe to a specific order's full updates (detail screen) */
  orderId?: string;
  /** Called when a subscribed order receives full data update */
  onOrderUpdated?: (orderId: string, data: unknown) => void;
  /** Called when any order changes (lightweight hint for list screens) */
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);
  // Store latest callbacks in refs so reconnects use up-to-date handlers
  const onOrderUpdatedRef = useRef(onOrderUpdated);
  const onOrdersChangedRef = useRef(onOrdersChanged);
  onOrderUpdatedRef.current = onOrderUpdated;
  onOrdersChangedRef.current = onOrdersChanged;

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    const token = await SecureStore.getItemAsync("martly_access_token");
    if (!token) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
      // Subscribe to specific order if watching detail
      if (orderId) {
        ws.send(JSON.stringify({ type: "subscribe", orderId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : "");
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
      // Exponential backoff reconnect
      const delay = backoffRef.current;
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, [orderId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    connect();

    // Reconnect when app comes to foreground
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        clearTimeout(reconnectTimerRef.current);
        backoffRef.current = 1000;
        connect();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
      clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);
}
