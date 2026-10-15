import type { ReactElement } from "react";
import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { EmptyState } from "../ui/EmptyState";
import { manage } from "../ui/tokens";

/** Empty state for an analytics screen that needs a single store while the scope is "All stores" */
export function StoreRequired({ title, message, picker }: { title: string; message: string; picker: ReactElement | null }) {
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      <View style={styles.wrap}>{picker}</View>
      <EmptyState icon="storefront-outline" title="Pick a store" message={message} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  wrap: { padding: 12 },
});
