import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Animated, LayoutAnimation, Platform, StyleSheet,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Scroll distance before reacting, so small jitters don't flicker the bar */
const THRESHOLD = 8;
/** Near the top the bar always shows */
const TOP_ZONE = 40;
/** Header collapses past this offset and expands again below the lower one (hysteresis avoids flicker at the edge) */
const COLLAPSE_AT = 64;
const EXPAND_AT = 24;

interface TabBarVisibility {
  /** 0 = shown, 1 = hidden. Native-driven transform only — the bar floats, so hiding never resizes a screen */
  progress: Animated.Value;
  setHidden: (hidden: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

/** Height of the bottom tab bar, including the home-indicator inset */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  // On iOS labels sit partly inside the home-indicator inset, as in other quick-commerce apps. Android draws a
  // translucent scrim over its navigation bar that washes out anything inside it, so labels stay clear of it there.
  const bottomPadding = Platform.OS === "android" ? insets.bottom + 6 : Math.max(insets.bottom - 8, 10);
  return { height: 52 + bottomPadding, bottomPadding };
}

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  const hiddenRef = useRef(false);

  const setHidden = useCallback((hidden: boolean) => {
    if (hiddenRef.current === hidden) return;
    hiddenRef.current = hidden;
    Animated.timing(progress, { toValue: hidden ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [progress]);

  const value = useMemo(() => ({ progress, setHidden }), [progress, setHidden]);
  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useTabBarProgress() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error("useTabBarProgress must be used within a TabBarVisibilityProvider");
  return ctx;
}

/** The bar's direction for this scroll event, or null to leave it as it is */
/** Bottom margin under the last row of a long list, where the bar hides on the way down */
const END_GAP = 16;

/** The bar's direction for this scroll event, or null to leave it as it is */
function nextVisibility(e: NativeScrollEvent, lastY: number, short: boolean): "show" | "hide" | null {
  const y = e.contentOffset.y;
  const room = e.contentSize.height - e.layoutMeasurement.height;
  if (short || y <= TOP_ZONE) return "show";
  // Reaching the end (and its bounce) keeps the bar as it is: hidden on the way down so the last row shows
  if (y >= room - THRESHOLD) return null;
  const dy = y - lastY;
  if (dy > THRESHOLD) return "hide";
  if (dy < -THRESHOLD) return "show";
  return null;
}

/**
 * Whether a list is too short to hide the bar. Judged on the content without our bottom padding, so changing the
 * padding (full bar height for short lists, a small gap for long ones) can never flip the answer.
 */
function useListLength(barHeight: number) {
  const [short, setShort] = useState(true);
  const sizes = useRef({ content: 0, viewport: 0, padding: barHeight });
  const measure = useCallback(() => {
    const { content, viewport, padding } = sizes.current;
    if (!content || !viewport) return;
    const room = content - padding - viewport;
    const next = room < barHeight * 2;
    sizes.current.padding = next ? barHeight : END_GAP;
    setShort(next);
  }, [barHeight]);
  const onContentSizeChange = useCallback((_w: number, h: number) => { sizes.current.content = h; measure(); }, [measure]);
  const onLayout = useCallback((e: LayoutChangeEvent) => { sizes.current.viewport = e.nativeEvent.layout.height; measure(); }, [measure]);
  return { short, onContentSizeChange, onLayout };
}

/**
 * The one auto-hide behaviour for every tab screen's main scroll view: the floating tab bar hides on scroll down
 * (staying hidden at the end so the last row shows) and returns on scroll up, near the top and on refocus. Short
 * lists keep it. Spread `scrollProps` onto the ScrollView/FlatList and pass its content style through `contentStyle`
 * (plus `extra` for a docked footer). `headerCollapsed` tells a large header to shrink once scrolled.
 */
export function useTabBarAutoHide() {
  const { setHidden } = useTabBarProgress();
  const { height: barHeight } = useTabBarHeight();
  const length = useListLength(barHeight);
  const lastY = useRef(0);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  useFocusEffect(useCallback(() => setHidden(false), [setHidden]));

  const updateHeader = useCallback((y: number) => {
    const next = collapsedRef.current ? y > EXPAND_AT : y > COLLAPSE_AT;
    if (next === collapsedRef.current) return;
    collapsedRef.current = next;
    LayoutAnimation.configureNext(LayoutAnimation.create(200, "easeInEaseOut", "opacity"));
    setHeaderCollapsed(next);
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    updateHeader(y);
    const next = nextVisibility(e.nativeEvent, lastY.current, length.short);
    if (next) setHidden(next === "hide");
    if (Math.abs(y - lastY.current) > THRESHOLD || next === "show") lastY.current = y;
  }, [setHidden, updateHeader, length.short]);

  const contentStyle = useCallback(
    (style?: StyleProp<ViewStyle>, extra = 0): StyleProp<ViewStyle> => {
      const own = (StyleSheet.flatten(style)?.paddingBottom as number | undefined) ?? 0;
      return [style, { paddingBottom: own + (length.short ? barHeight : END_GAP) + extra }];
    },
    [barHeight, length.short],
  );

  return {
    scrollProps: { onScroll, scrollEventThrottle: 16, onContentSizeChange: length.onContentSizeChange, onLayout: length.onLayout },
    headerCollapsed,
    contentStyle,
  };
}
