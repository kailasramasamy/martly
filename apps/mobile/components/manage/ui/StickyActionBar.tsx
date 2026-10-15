import type { ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { manage } from "./tokens";

/** Bottom-pinned action area for forms and detail screens; children are Buttons laid out in a row */
export function StickyActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: manage.card, borderTopWidth: 1, borderTopColor: manage.line,
  },
});
