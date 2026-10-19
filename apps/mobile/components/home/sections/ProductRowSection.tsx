import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import type { ProductRowSection as ProductRow } from "@martly/shared/types";
import { ProductList } from "../../ProductList";
import type { StoreProduct } from "../../../lib/types";
import { openSeeAll, useSectionText } from "./context";
import { SectionHeader } from "./SectionHeader";
import { SeeAllButton } from "./SeeAllButton";

/** A collection as a horizontal rail, with a "See all" pill when the collection holds more than the rail shows */
export const ProductRowSection = memo(function ProductRowSection({ section }: { section: ProductRow<StoreProduct> }) {
  const { title, subtitle } = useSectionText(section);
  const { seeAll } = section;
  const onSeeAll = useCallback(() => { if (seeAll) openSeeAll(seeAll); }, [seeAll]);

  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={subtitle} look={section.header.style} imageUrl={section.header.imageUrl} tint={section.header.tint} />
      <ProductList products={section.products} layout="rail" />
      {seeAll && <SeeAllButton onPress={onSeeAll} label={section.total > 0 ? `See all ${section.total} products` : "See all"} />}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: 24 },
});
