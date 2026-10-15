import type { ReactNode } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../constants/theme";
import { useTabBarProgress } from "../lib/tab-bar-visibility";

type IconName = keyof typeof Ionicons.glyphMap;

const INACTIVE = "#94a3b8";

export function TabIcon({ focused, icon, badge }: { focused: boolean; icon: IconName; badge?: number }) {
  const name = (focused ? icon : `${icon}-outline`) as IconName;
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.primary : INACTIVE} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  return { height: 62 + bottomPadding, bottomPadding };
}

/**
 * Wraps every tab screen: the bar floats (so it can slide away on the native driver) and this spacer
 * reserves its height, shrinking in step as it hides — content and sticky footers follow it down.
 */
export function TabSceneLayout({ children }: { children: ReactNode }) {
  const { height } = useTabBarHeight();
  const { layoutProgress } = useTabBarProgress();
  const spacer = layoutProgress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  return (
    <View style={styles.scene}>
      {children}
      <Animated.View style={{ height: spacer }} />
    </View>
  );
}

/** Shared bottom tab bar look for the Shop and Manage personas */
export function useTabBarOptions() {
  const { height, bottomPadding } = useTabBarHeight();
  const { progress } = useTabBarProgress();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: INACTIVE,
    tabBarLabelStyle: styles.tabLabel,
    tabBarStyle: { ...styles.tabBar, height, paddingBottom: bottomPadding, transform: [{ translateY }] },
    headerTitleStyle: styles.headerTitle,
    headerShadowVisible: false,
  };
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#eef2f6",
    backgroundColor: "#fff",
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: { fontFamily: fonts.bold, fontSize: 11.5, marginTop: 6 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  pill: { width: 60, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pillActive: { backgroundColor: "#ccfbf1" },
  badge: {
    position: "absolute",
    top: -4,
    right: 8,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10.5, color: colors.accentText },
});
