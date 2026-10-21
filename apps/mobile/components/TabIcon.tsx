import type { ReactNode } from "react";
import { View, Text, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { colors, fonts } from "../constants/theme";
import { useTabBarHeight, useTabBarProgress } from "../lib/tab-bar-visibility";

type IconName = keyof typeof Ionicons.glyphMap;

const INACTIVE = "#475569";
const ACTIVE_BG = "#e6f4f2";

export function TabIcon({ focused, icon, badge }: { focused: boolean; icon: IconName; badge?: number }) {
  const name = (focused ? icon : `${icon}-outline`) as IconName;
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={22} color={focused ? colors.primary : INACTIVE} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

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
 */
export function TabBottomDock({ children, onLayout }: { children: ReactNode; onLayout?: (e: LayoutChangeEvent) => void }) {
  const { height } = useTabBarHeight();
  const { progress } = useTabBarProgress();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return (
    <Animated.View style={[styles.dock, { bottom: height, transform: [{ translateY }] }]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}

/** The library paints the active background on its inner button with square corners, so round it here */
function TabButton(props: BottomTabBarButtonProps) {
  return <PlatformPressable {...props} style={[props.style, styles.tabButton]} />;
}

/** Shared bottom tab bar look for the Shop and Manage personas */
export function useTabBarOptions() {
  const { height, barHeight, gap } = useTabBarHeight();
  const { progress } = useTabBarProgress();
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] });
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: INACTIVE,
    tabBarActiveBackgroundColor: ACTIVE_BG,
    tabBarLabelStyle: styles.tabLabel,
    tabBarItemStyle: styles.tabItem,
    tabBarButton: TabButton,
    tabBarStyle: { ...styles.tabBar, height: barHeight, bottom: gap, transform: [{ translateY }] },
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
    marginHorizontal: 12,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 4,
    borderRadius: 31,
    borderTopWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  // Sized to the label, so a long label like "Categories" gets a wider highlight than "Cart"
  tabItem: { marginVertical: 5, flex: 0, flexGrow: 1, flexBasis: "auto" },
  tabButton: { flexGrow: 1, borderRadius: 26, paddingHorizontal: 10, paddingBottom: 9 },
  tabLabel: { fontFamily: fonts.bold, fontSize: 11, marginTop: 2 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  iconWrap: { width: 40, height: 26, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -4,
    right: 0,
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
