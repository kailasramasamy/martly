import { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { ProductRowSection as ProductRow } from "@martly/shared/types";
import { GRID_H_PADDING } from "../../FeaturedProductCard";
import { ProductList } from "../../ProductList";
import { useStrings } from "../../../lib/i18n/use-strings";
import type { StoreProduct } from "../../../lib/types";
import { openSeeAll, useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { SeeAllButton } from "./SeeAllButton";

// Product images previewed on the "See all" pill
const SEE_ALL_THUMBS = 3;

// One image per product, in shelf order
function productImages(products: StoreProduct[]) {
  const seen = new Set<string>();
  return products.flatMap((p) => {
    const uri = p.product.imageUrl || p.variant.imageUrl;
    if (seen.has(p.product.id) || !uri) return [];
    seen.add(p.product.id);
    return [uri];
  }).slice(0, SEE_ALL_THUMBS);
}

/** A collection as a three-column shelf of two rows, with a "See all" pill previewing what it opens */
export const ProductRowSection = memo(function ProductRowSection({ section }: { section: ProductRow<StoreProduct> }) {
  const t = useStrings("home");
  const { title, subtitle } = useSectionText(section);
  const { seeAll } = section;
  const onSeeAll = useCallback(() => { if (seeAll) openSeeAll(seeAll); }, [seeAll]);
  const { style: look, tint } = section.header;
  // A framed header's tint carries on behind the shelf, so the opener and its products read as one block
  const band = tint && look !== "PLAIN" ? { backgroundColor: tint } : null;
  const thumbs = useMemo(() => productImages(section.products), [section.products]);

  return (
    <View style={[styles.section, band && [styles.band, band]]}>
      <SectionHeader title={title} subtitle={subtitle} look={look} imageUrl={section.header.imageUrl} tint={tint} />
      {/* Nested in Home's list the grid drops its content padding, so the shelf pads itself */}
      <View style={styles.shelf}>
        <ProductList products={section.products} layout="grid" numColumns={3} scrollEnabled={false} elevated={band !== null} aisleLink contentContainerStyle={styles.flush} />
      </View>
      {seeAll && <SeeAllButton onPress={onSeeAll} thumbs={thumbs} label={section.total > 0 ? t.seeAllProducts(section.total) : undefined} />}
    </View>
  );
});

const styles = StyleSheet.create({
  shelf: { paddingHorizontal: GRID_H_PADDING },
  flush: { paddingHorizontal: 0 },
  section: { marginTop: 16 },
  band: { paddingTop: 10, paddingBottom: 12 },
});
