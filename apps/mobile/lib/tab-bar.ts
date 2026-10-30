import { useCallback, useRef, useState } from "react";
import {
  LayoutAnimation, Platform, StyleSheet,
  type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Header collapses past this offset and expands again below the lower one (hysteresis avoids flicker at the edge) */
const COLLAPSE_AT = 64;
const EXPAND_AT = 24;

/** Height of the bottom tab bar, including the home-indicator inset */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  // On iOS labels sit partly inside the home-indicator inset, as in other quick-commerce apps. Android draws a
  // translucent scrim over its navigation bar that washes out anything inside it, so labels stay clear of it there.
  const bottomPadding = Platform.OS === "android" ? insets.bottom + 6 : Math.max(insets.bottom - 8, 10);
  return { height: 52 + bottomPadding, bottomPadding };
}

/**
 * The one scroll behaviour for every tab screen's main scroll view. The tab bar floats over the content and always
 * stays in place, so less confident users never lose their way around. Spread `scrollProps` onto the
 * ScrollView/FlatList and pass its content style through `contentStyle` (plus `extra` for a docked footer) so the
 * last row clears the bar. `headerCollapsed` tells a large header to shrink once scrolled.
 */
export function useTabScroll() {
  const { height: barHeight } = useTabBarHeight();
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const collapsedRef = useRef(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = collapsedRef.current ? y > EXPAND_AT : y > COLLAPSE_AT;
    if (next === collapsedRef.current) return;
    collapsedRef.current = next;
    LayoutAnimation.configureNext(LayoutAnimation.create(200, "easeInEaseOut", "opacity"));
    setHeaderCollapsed(next);
  }, []);

  const contentStyle = useCallback(
    (style?: StyleProp<ViewStyle>, extra = 0): StyleProp<ViewStyle> => {
      const own = (StyleSheet.flatten(style)?.paddingBottom as number | undefined) ?? 0;
      return [style, { paddingBottom: own + barHeight + extra }];
    },
    [barHeight],
  );

  return { scrollProps: { onScroll, scrollEventThrottle: 16 }, headerCollapsed, contentStyle };
}
