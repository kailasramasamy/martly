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
import { notificationAudience, type NotificationAudience } from "@martly/shared/constants";
import { useAuth } from "./auth-context";
import { usePersona } from "./persona-context";
import { resolveNotificationDeepLink } from "./notification-helpers";
import { notificationTypeStyle } from "./notification-types";
import type { AppNotification } from "./types";
import { colors } from "../constants/theme";
import { API_URL } from "./config";

const WS_URL = API_URL.replace(/^http/, "ws");
const MAX_BACKOFF = 30000;
const BANNER_DURATION = 4000;

type Audience = NotificationAudience;
type NewListener = (notification: AppNotification) => void;

interface UnreadCounts {
  staff: number;
  customer: number;
}

interface NotificationContextType {
  /** Shopper unread count (kept for the customer bell) */
  unreadCount: number;
  staffUnreadCount: number;
  decrementUnread: (audience: Audience) => void;
  resetUnread: (audience: Audience) => void;
  /** Subscribe to live notifications; returns the unsubscribe function */
  onNew: (listener: NewListener) => () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  staffUnreadCount: 0,
  decrementUnread: () => {},
  resetUnread: () => {},
  onNew: () => () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { persona } = usePersona();
  const insets = useSafeAreaInsets();

  const [counts, setCounts] = useState<UnreadCounts>({ staff: 0, customer: 0 });
  const [bannerNotification, setBannerNotification] = useState<AppNotification | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerTranslateY = useRef(new Animated.Value(-100)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const listenersRef = useRef(new Set<NewListener>());
  const personaRef = useRef(persona);
  personaRef.current = persona;

  const fetchCounts = useCallback(() => {
    api.get<UnreadCounts>("/api/v1/notifications/unread-count")
      .then((res) => setCounts({ staff: res.data.staff, customer: res.data.customer }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setCounts({ staff: 0, customer: 0 });
      return;
    }
    fetchCounts();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchCounts();
    });
    return () => sub.remove();
  }, [isAuthenticated, fetchCounts]);

  const onNew = useCallback((listener: NewListener) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

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
    const target = resolveNotificationDeepLink(bannerNotification.data, bannerNotification.type);
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
          const audience = notificationAudience(notification.type);
          setCounts((prev) => ({ ...prev, [audience]: prev[audience] + 1 }));
          listenersRef.current.forEach((listener) => listener(notification));
          // Staff alerts need action wherever the user is; shopper updates only show while shopping
          if (audience === "staff" || personaRef.current === "shop") showBanner(notification);
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

  const decrementUnread = useCallback((audience: Audience) => {
    setCounts((prev) => ({ ...prev, [audience]: Math.max(0, prev[audience] - 1) }));
  }, []);

  const resetUnread = useCallback((audience: Audience) => {
    setCounts((prev) => ({ ...prev, [audience]: 0 }));
  }, []);

  const config = notificationTypeStyle(bannerNotification?.type ?? "");

  return (
    <NotificationContext.Provider
      value={{ unreadCount: counts.customer, staffUnreadCount: counts.staff, decrementUnread, resetUnread, onNew }}
    >
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
