import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { View, type GestureResponderEvent } from "react-native";
import type { HomeSectionType } from "@martly/shared/constants";
import { recordSectionTap, type SectionSource } from "./home-events";

const SectionSourceContext = createContext<SectionSource | null>(null);

/** The Home section a component sits in, so a cart add or tap inside it is credited to that section */
export const useSectionSource = () => useContext(SectionSourceContext);

// A touch that moves less than this and lifts quickly is a tap, not a swipe through a row
const TAP_SLOP = 10;
const TAP_MS = 500;

interface ProviderProps {
  storeId?: string;
  sectionId: string;
  sectionType: HomeSectionType;
  children: ReactNode;
}

/** Provides the section to everything inside it and counts the shopper's taps there */
export function SectionSourceProvider({ storeId, sectionId, sectionType, children }: ProviderProps) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const value = useMemo(() => ({ sectionId, sectionType }), [sectionId, sectionType]);
  const onTouchStart = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now() };
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || Date.now() - s.t > TAP_MS) return;
    if (Math.abs(e.nativeEvent.pageX - s.x) < TAP_SLOP && Math.abs(e.nativeEvent.pageY - s.y) < TAP_SLOP) recordSectionTap(storeId, value);
  };
  return (
    <SectionSourceContext.Provider value={value}>
      <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>{children}</View>
    </SectionSourceContext.Provider>
  );
}
