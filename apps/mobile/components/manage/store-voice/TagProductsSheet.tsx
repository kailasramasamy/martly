import { useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { Loader } from "../../Loader";
import { BottomSheet } from "../../search/BottomSheet";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { SearchField } from "../ui/SearchField";
import { describeListing, type FeaturedStoreProduct } from "../products/featured-types";

export type TaggedProduct = { id: string; name: string; imageUrl: string | null };

interface Props {
  visible: boolean;
  storeId: string;
  tagged: TaggedProduct[];
  onToggle: (product: TaggedProduct) => void;
  onClose: () => void;
}

/** The store's listings to tag in a post; one tag per product, whichever size the search found */
export function TagProductsSheet({ visible, storeId, tagged, onToggle, onClose }: Props) {
  const [q, setQ] = useState("");
  const params = useMemo(() => ({ storeId, q }), [storeId, q]);
  const list = usePagedList<FeaturedStoreProduct>("/api/v1/store-products", params, { enabled: visible });
  const on = new Set(tagged.map((p) => p.id));
  // One row per product (sizes of the same product would tag the same thing), from listings shoppers can buy
  const listed = list.items.filter((sp) => sp.isActive);
  const rows = listed.filter((sp, i) => listed.findIndex((o) => o.product.id === sp.product.id) === i);
  return (
    <BottomSheet
      flush visible={visible} title="Tag products" onClose={onClose}
      footer={<Button label={tagged.length ? `Done · ${tagged.length} tagged` : "Done"} icon="checkmark" onPress={onClose} style={styles.done} />}
    >
      <View style={styles.search}><SearchField value={q} onChange={setQ} placeholder="Search products" /></View>
      <FlatList
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        data={rows}
        keyExtractor={(sp) => sp.product.id}
        onEndReached={list.loadMore}
        style={styles.list}
        ListEmptyComponent={list.loading ? <Loader style={styles.loading} /> : <EmptyState icon="search-outline" title="No products found" />}
        renderItem={({ item }) => {
          const tag = on.has(item.product.id);
          const product = { id: item.product.id, name: item.product.name, imageUrl: item.product.imageUrl };
          return (
            <ListRow
              title={item.product.name}
              subtitle={describeListing(item, false)}
              imageUrl={item.product.imageUrl}
              trailing={<Button label={tag ? "Tagged" : "Tag"} icon={tag ? "checkmark" : "add"} compact variant={tag ? "secondary" : "primary"} onPress={() => onToggle(product)} />}
            />
          );
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { minHeight: 320 },
  loading: { marginTop: 40 },
  done: { marginHorizontal: 16 },
});
