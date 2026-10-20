import { useEffect, useRef } from "react";
import { Animated, View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useNotifications } from "../../lib/notification-context";
import { useRequireSignIn } from "../../lib/sign-in-context";
import { useAuth } from "../../lib/auth-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { HomeHeaderLocation } from "../HomeHeaderLocation";
import { SearchBarButton } from "../SearchBarButton";
import type { HomeTheme } from "@martly/shared/types";
import type { Store } from "../../lib/types";

interface Props {
  store: Store | null;
  userArea: string | null;
  onPickStore: () => void;
  /** Festive art runs up behind the header: it floats over the list, see-through, in the festival's title colour */
  festive?: HomeTheme | null;
  /** Scrolled: the location row folds away and only the search bar stays pinned (Zepto-style) */
  collapsed?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** The search bar's rotating suggestions, from the server's home chrome */
  searchHints?: string[];
}

/** Over festive art the header is clear at the top of the page; once scrolled a solid festive band fades in behind it */
function useFestiveBand(collapsed: boolean) {
  const band = useRef(new Animated.Value(collapsed ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(band, { toValue: collapsed ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [band, collapsed]);
  return band;
}

export function HomeHeader({ store, userArea, onPickStore, festive, collapsed = false, onLayout, searchHints }: Props) {
  const t = useStrings("home");
  const requireSignIn = useRequireSignIn();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const { isAuthenticated } = useAuth();
  const band = useFestiveBand(collapsed);
  const tint = Boolean(festive);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }, festive ? styles.overlay : null]} onLayout={onLayout}>
      {festive && <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: festive.background, opacity: band }]} pointerEvents="none" />}
      {!collapsed && (
      <View style={[styles.headerRow, !store && styles.headerRowAlone]}>
        <HomeHeaderLocation store={store} userArea={userArea} onPress={onPickStore} ink={festive?.title} />
        {!store && !isAuthenticated ? (
          // Before a store is chosen there's nothing to browse yet; returning customers can still sign in
          <TouchableOpacity style={styles.signIn} onPress={() => requireSignIn(() => {}, { title: t.welcomeBack, subtitle: t.signInWithPhone })} accessibilityRole="button">
            <Text style={styles.signInText}>{t.signIn}</Text>
          </TouchableOpacity>
        ) : (
        <TouchableOpacity
          style={[styles.iconBtn, tint ? styles.onTint : null]}
          onPress={() => requireSignIn(() => router.push({ pathname: "/notifications", params: { audience: "customer" } }), { title: t.signInForNotifications })}
          accessibilityRole="button"
          accessibilityLabel={t.notifications}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        )}
      </View>
      )}
      {store && <SearchBarButton onTint={tint} hints={searchHints} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: "transparent", borderBottomWidth: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  headerRowAlone: { marginBottom: 0 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  onTint: { backgroundColor: "rgba(255,255,255,0.85)" },
  signIn: { height: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  signInText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  bellBadge: {
    position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center", paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
});
