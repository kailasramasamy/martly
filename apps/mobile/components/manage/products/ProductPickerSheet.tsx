import { useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import { BottomSheet } from "../../search/BottomSheet";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { colors } from "../../../constants/theme";
import { SearchField } from "../ui/SearchField";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import type { ProductListItem } from "./types";

interface ProductPickerSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (product: ProductListItem) => void;
  pickedIds: string[];
}

/** Search the catalog and tap products to add them; stays open so several can be added in a row */
export function ProductPickerSheet({ visible, title, onClose, onPick, pickedIds }: ProductPickerSheetProps) {
  const [q, setQ] = useState("");
  const list = usePagedList<ProductListItem>("/api/v1/products", { q }, { enabled: visible && q.trim().length > 0 });

  return (
    <BottomSheet flush visible={visible} title={title} onClose={onClose}>
      <View style={styles.search}><SearchField value={q} onChange={setQ} placeholder="Search products" /></View>
      <FlatList
        keyboardDismissMode="on-drag"
        data={q.trim() ? list.items : []}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={list.loadMore}
        style={styles.list}
        ListEmptyComponent={list.loading
          ? <Loader style={styles.loading} />
          : <EmptyState icon="search-outline" title={q ? "No products found" : "Search to add products"} />}
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={[item.brand?.name, item.subcategory?.name].filter(Boolean).join(" · ")}
            imageUrl={item.imageUrl}
            selected={pickedIds.includes(item.id)}
            onPress={() => onPick(item)}
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
});
