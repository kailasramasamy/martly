import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import type { MonthCursor } from "./calendar-data";

const offsetMonth = ({ y, m }: MonthCursor, delta: number): MonthCursor => {
  const d = new Date(y, m + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};

interface MonthPagerProps {
  cursor: MonthCursor;
  onShift: (delta: number) => void;
  renderMonth: (cursor: MonthCursor) => ReactNode;
}

/**
 * Swipe between months: the previous, current and next month sit side by side in a native paging scroll, so the swipe
 * feels like iOS and doesn't fight the page's vertical scroll. Landing on a neighbour shifts the month and re-centres.
 */
export function MonthPager({ cursor, onShift, renderMonth }: MonthPagerProps) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);

  // Keep the current month in the middle page whenever the month or the width changes
  useEffect(() => {
    if (width) scroll.current?.scrollTo({ x: width, animated: false });
  }, [width, cursor]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    if (page !== 1) onShift(page - 1);
  };

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: width, y: 0 }}
          onMomentumScrollEnd={onSettle}
        >
          {[-1, 0, 1].map((delta) => (
            <View key={delta} style={{ width }}>{renderMonth(offsetMonth(cursor, delta))}</View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
