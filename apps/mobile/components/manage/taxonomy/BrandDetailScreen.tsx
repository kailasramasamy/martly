import { useState } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { canEditCatalogRecord } from "@martly/shared/permissions";
import { colors, fonts, radius } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageListScreen } from "../ManageListScreen";
import { ManageStackScreen } from "../ManageStackScreen";
import { HeaderAction } from "../HeaderAction";
import { FacetChips, type SearchFacetsMeta } from "../ui/FacetChips";
import { manage } from "../ui/tokens";
import { ProductTile } from "../inventory/ProductTile";
import { CatalogPill } from "../products/CatalogPill";
import { ListingPill } from "../products/ListingPill";
import { useManageScope } from "../../../lib/manage-scope-context";
import type { ProductListItem } from "../products/types";
import type { BrandRecord } from "./brand-types";

function Swatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

function BrandHeader({ brand, productCount }: { brand: BrandRecord; productCount: number | null }) {
  return (
    <View style={styles.header}>
      {brand.imageUrl ? <Image source={{ uri: brand.imageUrl }} style={styles.logo} resizeMode="contain" /> : <View style={[styles.logo, styles.noLogo]} />}
      <View style={styles.headerText}>
        <CatalogPill organizationId={brand.organizationId} />
        <Text style={styles.slug}>{brand.slug}{productCount !== null ? ` \u00B7 ${productCount} product${productCount === 1 ? "" : "s"}` : ""}</Text>
        <View style={styles.swatches}>
          {brand.themeColor ? <Swatch color={brand.themeColor} /> : null}
          {brand.themeColorSecondary ? <Swatch color={brand.themeColorSecondary} /> : null}
        </View>
      </View>
    </View>
  );
}

export function BrandDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const brand = useResource<BrandRecord>(`/api/v1/brands/${id}`);
  const [q, setQ] = useState("");
  const [facet, setFacet] = useState<string | null>(null);
  const { storeId } = useManageScope();
  const list = usePagedList<ProductListItem, SearchFacetsMeta>("/api/v1/products", { brandId: id, q, subcategoryId: facet, withFacets: true, includeStoreProducts: true });
  const canEdit = !!brand.data && canEditCatalogRecord(user, "brands", brand.data);

  if (brand.loading || brand.error) {
    return <ManageStackScreen title="Brand" loading={brand.loading} error={brand.error} onRetry={brand.reload}><View /></ManageStackScreen>;
  }
  return (
    <ManageListScreen
      title={brand.data?.name ?? "Brand"}
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search this brand's products" }}
      headerRight={canEdit ? () => <HeaderAction icon="create-outline" onPress={() => router.push(`/manage/brands/${id}/edit`)} accessibilityLabel="Edit brand" /> : undefined}
      filters={brand.data ? (
        <>
          <BrandHeader brand={brand.data} productCount={q || facet || list.loading ? null : list.total} />
          <FacetChips facets={list.meta?.facets?.subcategories} value={facet} onChange={setFacet} />
        </>
      ) : undefined}
      empty={{ icon: "cube-outline", title: "No products for this brand" }}
      columns={3}
      renderItem={(p, cell) => (
        <ProductTile
          product={p}
          width={cell.width}
          badge={<ListingPill listings={p.storeProducts} storeId={storeId} />}
          dimmed={!p.isActive}
          onPress={() => router.push(`/manage/products/${p.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 112, height: 56, borderRadius: radius.md, backgroundColor: manage.card },
  noLogo: { borderWidth: 1, borderColor: manage.line },
  headerText: { flex: 1, gap: 6 },
  slug: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  swatches: { flexDirection: "row", gap: 6 },
  swatch: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: manage.line },
});
