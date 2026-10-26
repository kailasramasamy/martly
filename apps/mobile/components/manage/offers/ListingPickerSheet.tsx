import { useMemo, useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import { BottomSheet } from "../../search/BottomSheet";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import { ListRow } from "../ui/ListRow";
import { SearchField } from "../ui/SearchField";
import { formatINR } from "../ui/tokens";
import type { StoreProductItem } from "../inventory/types";

export interface PickedListing {
  id: string;
  name: string;
  size: string;
  price: number;
  imageUrl: string | null;
}

interface ListingPickerSheetProps {
  visible: boolean;
  storeId: string;
  picked: PickedListing[];
  onToggle: (listing: PickedListing) => void;
  onClose: () => void;
}

const toPicked = (sp: StoreProductItem): PickedListing => ({
  id: sp.id, name: sp.product.name, size: sp.variant.name, price: Number(sp.price), imageUrl: sp.product.imageUrl,
});

/** The store's listings, searchable; tap a size to add it to the offer or take it off, then Done */
export function ListingPickerSheet({ visible, storeId, picked, onToggle, onClose }: ListingPickerSheetProps) {
  const [q, setQ] = useState("");
  const params = useMemo(() => ({ storeId, q }), [storeId, q]);
  const list = usePagedList<StoreProductItem>("/api/v1/store-products", params, { enabled: visible && q.trim().length > 0 });
  const pickedIds = new Set(picked.map((p) => p.id));

  return (
    <BottomSheet
      flush
      visible={visible}
      title={picked.length ? `Products · ${picked.length} picked` : "Pick products"}
      onClose={onClose}
      footer={<Button label="Done" icon="checkmark" onPress={onClose} style={styles.done} />}
      hideFooterWhileTyping
    >
      <View style={styles.search}><SearchField value={q} onChange={setQ} placeholder="Search products" returnKeyType="done" loading={list.loading} /></View>
      <FlatList
        keyboardDismissMode="on-drag"
        data={q.trim() ? list.items : []}
        keyExtractor={(sp) => sp.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={list.loadMore}
        style={styles.list}
        ListEmptyComponent={list.loading
          ? <Loader style={styles.loading} />
          : <EmptyState icon="search-outline" title={q ? "No products found" : "Search to add products"} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.product.name}
            subtitle={`${item.variant.name} · ${formatINR(Number(item.price), { decimals: true })}`}
            imageUrl={item.product.imageUrl}
            selected={pickedIds.has(item.id)}
            onPress={() => onToggle(toPicked(item))}
          />
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { minHeight: 280 },
  loading: { marginTop: 40 },
  done: { marginHorizontal: 16 },
});
