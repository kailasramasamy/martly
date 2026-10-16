import { useMemo, useState } from "react";
import { View, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { api } from "../../../lib/api";
import { colors } from "../../../constants/theme";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { SearchField } from "../ui/SearchField";
import { describeListing, type FeaturedStoreProduct } from "./featured-types";

interface FeaturePickerSheetProps {
  visible: boolean;
  storeId: string | null;
  onClose: () => void;
}

/** Store listings that are not featured yet; tap Feature to promote one without closing the sheet */
export function FeaturePickerSheet({ visible, storeId, onClose }: FeaturePickerSheetProps) {
  const [q, setQ] = useState("");
  const { run } = useAction();
  const params = useMemo(() => ({ isFeatured: "false", storeId, q }), [storeId, q]);
  const list = usePagedList<FeaturedStoreProduct>("/api/v1/store-products", params, { enabled: visible });

  const feature = async (sp: FeaturedStoreProduct) => {
    const ok = await run(() => api.put(`/api/v1/store-products/${sp.id}`, { isFeatured: true }), "Marked as featured");
    if (ok) list.updateItem(sp.id, { isFeatured: true });
  };

  return (
    <BottomSheet flush visible={visible} title="Add featured products" onClose={onClose}>
      <View style={styles.search}><SearchField value={q} onChange={setQ} placeholder="Search products" /></View>
      <FlatList
        keyboardDismissMode="on-drag"
        data={list.items}
        keyExtractor={(sp) => sp.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={list.loadMore}
        style={styles.list}
        ListEmptyComponent={list.loading ? <ActivityIndicator style={styles.loading} color={colors.primary} /> : <EmptyState icon="search-outline" title="No products to feature" />}
        renderItem={({ item }) => (
          <ListRow
            title={item.product.name}
            subtitle={describeListing(item, !storeId)}
            imageUrl={item.product.imageUrl}
            trailing={<Button label={item.isFeatured ? "Featured" : "Feature"} icon={item.isFeatured ? "checkmark" : "star-outline"} compact variant={item.isFeatured ? "secondary" : "primary"} disabled={item.isFeatured} onPress={() => feature(item)} />}
          />
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { minHeight: 320 },
  loading: { marginTop: 40 },
});
