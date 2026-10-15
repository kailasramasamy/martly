import { FlatList, StyleSheet } from "react-native";
import { SectionCard } from "../ui/SectionCard";
import { ListRow } from "../ui/ListRow";
import { formatINR } from "../ui/tokens";
import type { PickedVariant } from "./types";

export function ReviewStep({ picked, storeName }: { picked: PickedVariant[]; storeName: string }) {
  return (
    <FlatList
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      data={picked}
      keyExtractor={(p) => p.variantId}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<SectionCard title="Ready to add"><ListRow title={`${picked.length} variant${picked.length === 1 ? "" : "s"}`} subtitle={`will be listed at ${storeName}`} icon="storefront-outline" /></SectionCard>}
      renderItem={({ item }) => (
        <ListRow title={item.productName} subtitle={`${item.variantName} · ${item.stock || 0} in stock`} value={formatINR(Number(item.price), { decimals: true })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
});
