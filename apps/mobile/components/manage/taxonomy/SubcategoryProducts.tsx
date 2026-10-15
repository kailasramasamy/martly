import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../constants/theme";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { ListRow } from "../ui/ListRow";
import { CatalogPill } from "../products/CatalogPill";
import type { ProductListItem } from "../products/types";

interface SubcategoryProductsProps {
  id: string;
  name?: string;
  path?: string[];
  canWrite: boolean;
}

/** Leaf of the category drill-down: the products filed under one subcategory */
export function SubcategoryProducts({ id, name, path, canWrite }: SubcategoryProductsProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = usePagedList<ProductListItem>("/api/v1/products", { subcategoryId: id, q });

  return (
    <ManageListScreen
      title={name ?? "Subcategory"}
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search in this subcategory" }}
      headerRight={canWrite ? () => <HeaderAction icon="create-outline" onPress={() => router.push(`/manage/categories/${id}/edit?level=subcategory`)} accessibilityLabel="Edit" /> : undefined}
      filters={<Text style={styles.summary}>{[path?.slice(0, -1).join(" › "), `${list.total} product${list.total === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</Text>}
      empty={{ icon: "cube-outline", title: "No products in this subcategory" }}
      renderItem={(p) => (
        <ListRow
          title={p.name}
          subtitle={[p.brand?.name, `${p.variants.length} variant${p.variants.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
          imageUrl={p.imageUrl}
          trailing={<CatalogPill organizationId={p.organizationId} />}
          chevron
          onPress={() => router.push(`/manage/products/${p.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  summary: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
});
