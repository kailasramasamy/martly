import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  Animated,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
  AppState,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { resolveNotificationDeepLink } from "./notification-helpers";
import type { AppNotification } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:7001";
const WS_URL = API_URL.replace(/^http/, "ws");
const MAX_BACKOFF = 30000;
const BANNER_DURATION = 4000;

const TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  ORDER_CONFIRMED: { icon: "checkmark-circle", bg: "#dbeafe", color: "#2563eb" },
  ORDER_PREPARING: { icon: "restaurant", bg: "#ffedd5", color: "#ea580c" },
  ORDER_READY: { icon: "bag-check", bg: "#e0e7ff", color: "#4f46e5" },
  ORDER_OUT_FOR_DELIVERY: { icon: "bicycle", bg: "#f3e8ff", color: "#7c3aed" },
  ORDER_DELIVERED: { icon: "checkmark-done-circle", bg: "#dcfce7", color: "#16a34a" },
  ORDER_CANCELLED: { icon: "close-circle", bg: "#fee2e2", color: "#dc2626" },
  WALLET_CREDITED: { icon: "wallet", bg: "#ccfbf1", color: "#0d9488" },
  WALLET_DEBITED: { icon: "wallet-outline", bg: "#ccfbf1", color: "#0d9488" },
  LOYALTY_POINTS_EARNED: { icon: "star", bg: "#fef3c7", color: "#d97706" },
  LOYALTY_POINTS_REDEEMED: { icon: "star-outline", bg: "#fef3c7", color: "#d97706" },
  PROMOTIONAL: { icon: "megaphone", bg: "#fce7f3", color: "#db2777" },
  GENERAL: { icon: "information-circle", bg: "#f1f5f9", color: "#475569" },
  WELCOME: { icon: "sparkles", bg: "#e0f2fe", color: "#0284c7" },
  REVIEW_REQUEST: { icon: "chatbubble-ellipses", bg: "#fff7ed", color: "#d97706" },
};

const DEFAULT_CONFIG = { icon: "notifications" as keyof typeof Ionicons.glyphMap, bg: "#f1f5f9", color: "#64748b" };

interface NotificationContextType {
  unreadCount: number;
  decrementUnread: () => void;
  resetUnreadCount: (n: number) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  decrementUnread: () => {},
  resetUnreadCount: () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();

  const [unreadCount, setUnreadCount] = useState(0);
  const [bannerNotification, setBannerNotification] = useState<AppNotification | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerTranslateY = useRef(new Animated.Value(-100)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  // Fetch initial unread count
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    api.get<{ count: number }>("/api/v1/notifications/unread-count")
      .then((res) => setUnreadCount(res.data.count))
      .catch(() => {});
  }, [isAuthenticated]);

  // Show in-app banner
  const showBanner = useCallback((notification: AppNotification) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);

    setBannerNotification(notification);
    bannerTranslateY.setValue(-100);
    bannerOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(bannerTranslateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(bannerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    bannerTimerRef.current = setTimeout(() => {
      dismissBanner();
    }, BANNER_DURATION);
  }, []);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    Animated.parallel([
      Animated.timing(bannerTranslateY, { toValue: -100, duration: 250, useNativeDriver: true }),
      Animated.timing(bannerOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setBannerNotification(null));
  }, []);

  const handleBannerTap = useCallback(() => {
    if (!bannerNotification) return;
    const target = resolveNotificationDeepLink(bannerNotification.data);
    dismissBanner();
    router.push(target);
  }, [bannerNotification, dismissBanner]);

  // WebSocket connection
  const connect = useCallback(async () => {
    if (!mountedRef.current) return;

    const token = await SecureStore.getItemAsync("martly_access_token");
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : "");
        if (msg.type === "notification:new" && msg.data) {
          const notification = msg.data as AppNotification;
          setUnreadCount((prev) => prev + 1);
          showBanner(notification);
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
      // onclose will fire after onerror, triggering reconnect
    };
  }, [showBanner]);

  useEffect(() => {
    mountedRef.current = true;

    if (!isAuthenticated) {
      // Clean up WS when logged out
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      clearTimeout(reconnectTimerRef.current);
      return;
    }

    connect();

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
      clearTimeout(bannerTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, isAuthenticated]);

  const decrementUnread = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const resetUnreadCount = useCallback((n: number) => {
    setUnreadCount(n);
  }, []);

  const config = bannerNotification
    ? (TYPE_CONFIG[bannerNotification.type] ?? DEFAULT_CONFIG)
    : DEFAULT_CONFIG;

  return (
    <NotificationContext.Provider value={{ unreadCount, decrementUnread, resetUnreadCount }}>
      {children}
      {bannerNotification && (
        <Animated.View
          style={[
            styles.bannerWrapper,
            { top: insets.top + 8, opacity: bannerOpacity, transform: [{ translateY: bannerTranslateY }] },
          ]}
        >
          <TouchableOpacity
            style={styles.banner}
            activeOpacity={0.9}
            onPress={handleBannerTap}
          >
            <View style={[styles.bannerIcon, { backgroundColor: config.bg }]}>
              <Ionicons name={config.icon} size={20} color={config.color} />
            </View>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{bannerNotification.title}</Text>
              <Text style={styles.bannerBody} numberOfLines={1}>{bannerNotification.body}</Text>
            </View>
            <TouchableOpacity
              onPress={dismissBanner}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

const styles = StyleSheet.create({
  bannerWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  bannerBody: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
});
