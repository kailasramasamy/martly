import { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import { ListSkeleton } from "../ui/ListSkeleton";
import { manage } from "../ui/tokens";
import { TaxonomyPicker } from "../taxonomy/TaxonomyPicker";
import { EMPTY_SELECTION, type DepartmentNode, type TaxonomySelection } from "../taxonomy/types";
import type { OnboardProduct, OnboardVariant, PickedVariant } from "./types";

interface BrowseStepProps {
  tree: DepartmentNode[];
  picked: Record<string, PickedVariant>;
  onToggle: (product: OnboardProduct, variant: OnboardVariant) => void;
}

function deepestId(sel: TaxonomySelection): string {
  return sel.subcategoryId || sel.categoryId || sel.departmentId;
}

function ProductBlock({ product, picked, onToggle }: { product: OnboardProduct } & Pick<BrowseStepProps, "picked" | "onToggle">) {
  return (
    <View style={styles.block}>
      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
      {product.variants.map((v) => (
        <ListRow key={v.id} title={v.name} selected={!!picked[v.id]} onPress={() => onToggle(product, v)} />
      ))}
    </View>
  );
}

export function BrowseStep({ tree, picked, onToggle }: BrowseStepProps) {
  const [sel, setSel] = useState<TaxonomySelection>(EMPTY_SELECTION);
  const categoryId = deepestId(sel);
  const path = useMemo(() => `/api/v1/categories/${categoryId}/products`, [categoryId]);
  const list = usePagedList<OnboardProduct>(path, {}, { pageSize: 50, enabled: !!categoryId });

  const empty = !categoryId
    ? <EmptyState icon="file-tray-stacked-outline" title="Pick a category" message="Choose a department, then narrow down to see its products." />
    : list.loading ? <ListSkeleton /> : <EmptyState icon="cube-outline" title="No products here" />;

  return (
    <FlatList
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      data={categoryId ? list.items : []}
      keyExtractor={(p) => p.id}
      onEndReached={list.loadMore}
      ListHeaderComponent={<View style={styles.picker}><TaxonomyPicker allowAny tree={tree} value={sel} onChange={setSel} /></View>}
      ListEmptyComponent={empty}
      renderItem={({ item }) => <ProductBlock product={item} picked={picked} onToggle={onToggle} />}
    />
  );
}

const styles = StyleSheet.create({
  picker: { padding: 14, backgroundColor: manage.canvas },
  block: { backgroundColor: manage.card, borderBottomWidth: 6, borderBottomColor: manage.canvas },
  productName: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, paddingHorizontal: 14, paddingTop: 12 },
});
