import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, LayoutAnimation, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useFocusEffect } from "expo-router";

/** Scroll distance before reacting, so small jitters don't flicker the bar */
const THRESHOLD = 8;
/** Near the top the bar always shows */
const TOP_ZONE = 40;
/** Header collapses past this offset and expands again below the lower one (hysteresis avoids flicker at the edge) */
const COLLAPSE_AT = 64;
const EXPAND_AT = 24;

interface TabBarVisibility {
  /** 0 = shown, 1 = hidden. Native-driven: moves the tab bar */
  progress: Animated.Value;
  /** Same curve, JS-driven: resizes the spacer under each tab screen (layout props can't use the native driver) */
  layoutProgress: Animated.Value;
  setHidden: (hidden: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  const layoutProgress = useRef(new Animated.Value(0)).current;
  const hiddenRef = useRef(false);

  const setHidden = useCallback((hidden: boolean) => {
    if (hiddenRef.current === hidden) return;
    hiddenRef.current = hidden;
    const toValue = hidden ? 1 : 0;
    Animated.parallel([
      Animated.timing(progress, { toValue, duration: 220, useNativeDriver: true }),
      Animated.timing(layoutProgress, { toValue, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [progress, layoutProgress]);

  const value = useMemo(() => ({ progress, layoutProgress, setHidden }), [progress, layoutProgress, setHidden]);
  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useTabBarProgress() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error("useTabBarProgress must be used within a TabBarVisibilityProvider");
  return ctx;
}

/**
 * Scroll behaviour for a tab screen's main scroll view (Zepto-style): the tab bar hides while scrolling down and
 * returns on scroll up, near the top, and on refocus; `headerCollapsed` tells a large header to shrink once scrolled.
 * Spread `scrollProps` onto the ScrollView/FlatList.
 */
export function useTabBarAutoHide() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) throw new Error("useTabBarAutoHide must be used within a TabBarVisibilityProvider");
  const { setHidden } = ctx;
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
    const dy = y - lastY.current;
    if (y <= TOP_ZONE) setHidden(false);
    else if (dy > THRESHOLD) setHidden(true);
    else if (dy < -THRESHOLD) setHidden(false);
    if (Math.abs(dy) > THRESHOLD || y <= TOP_ZONE) lastY.current = y;
  }, [setHidden, updateHeader]);

  return { scrollProps: { onScroll, scrollEventThrottle: 16 }, headerCollapsed };
}
