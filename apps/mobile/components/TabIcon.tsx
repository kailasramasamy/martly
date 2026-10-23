import { useEffect, useState, type ReactNode } from "react";
import { useIsFocused } from "@react-navigation/native";
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useTabBarHeight, useTabBarProgress } from "../lib/tab-bar-visibility";
import { useToast } from "../lib/toast-context";

type IconName = keyof typeof Ionicons.glyphMap;

export const TAB_INACTIVE = "#475569";

export function TabIcon({ focused, icon, badge }: { focused: boolean; icon: IconName; badge?: number }) {
  const name = (focused ? icon : `${icon}-outline`) as IconName;
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={name} size={20} color={focused ? colors.primary : TAB_INACTIVE} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const tabLabelStyle = { fontFamily: fonts.bold, fontSize: 10.5, marginTop: 3 } as const;

/**
 * Wraps every tab screen. The bar floats over the content and slides away on the native driver, so hiding it
 * never resizes the screen; scroll views clear it with `useTabBarAutoHide().contentStyle`.
 */
export function TabSceneLayout({ children }: { children: ReactNode }) {
  return <View style={styles.scene}>{children}</View>;
}

/**
 * A sticky footer on a tab screen (checkout bar, floating cart, bulk actions): sits just above the tab bar and
 * slides down with it when the bar hides. Report its height via `onLayout` to pad the list above it.
 * While its screen is in view, toasts rise above it instead of covering it.
 */
interface TabBottomDockProps {
  children: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  /** The screen has hidden the tab bar, so the dock sits on the screen's bottom edge; its content clears the home indicator */
  noTabBar?: boolean;
}

export function TabBottomDock({ children, onLayout, noTabBar }: TabBottomDockProps) {
  const { height } = useTabBarHeight();
  const { progress } = useTabBarProgress();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  const focused = useIsFocused();
  const { setDockHeight } = useToast();
  const [dockHeight, setOwnHeight] = useState(0);

  useEffect(() => {
    if (!focused) return;
    setDockHeight(dockHeight);
    return () => setDockHeight(0);
  }, [focused, dockHeight, setDockHeight]);

  return (
    <Animated.View
      style={[styles.dock, noTabBar ? { bottom: 0 } : { bottom: height, transform: [{ translateY }] }]}
      onLayout={(e) => {
        setOwnHeight(e.nativeEvent.layout.height);
        onLayout?.(e);
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Shared bottom tab bar look for the Shop and Manage personas */
export function useTabBarOptions() {
  const { height, bottomPadding } = useTabBarHeight();
  const { progress } = useTabBarProgress();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: TAB_INACTIVE,
    tabBarLabelStyle: tabLabelStyle,
    tabBarStyle: { ...styles.tabBar, height, paddingBottom: bottomPadding, transform: [{ translateY }] },
    headerTitleStyle: styles.headerTitle,
    headerShadowVisible: false,
  };
}

const styles = StyleSheet.create({
  dock: { position: "absolute", left: 0, right: 0 },
  scene: { flex: 1 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#eef2f6",
    backgroundColor: "#fff",
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  pill: { width: 56, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
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
